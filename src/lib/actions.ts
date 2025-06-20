
"use server";

import type { AppConfig, FtpServerDetails, MonitoredFolderConfig, LogEntry as AppLogEntry, FetchFtpFolderResponse as ServerFetchResponse, LocalDirectoryListing, LocalDirectoryResponse, DownloadLocalFileResponse, User, UserDocument, UserRole } from "@/types";
import { z } from "zod";
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { Client, FileInfo } from 'basic-ftp';
import { Writable } from 'stream'; 
import { connectToDatabase } from './db';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { createSession, deleteSession } from './auth';
import { redirect } from 'next/navigation';

const ftpOperationLogs: AppLogEntry[] = [];
const MAX_FTP_LOGS = 200; 

function addFtpLog(message: string, type: AppLogEntry['type']) {
  const newLog: AppLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    message,
    type,
  };
  ftpOperationLogs.unshift(newLog); 
  if (ftpOperationLogs.length > MAX_FTP_LOGS) {
    ftpOperationLogs.length = MAX_FTP_LOGS; 
  }
}

class BufferCollector extends Writable {
    private chunks: Buffer[] = [];
    constructor(options?: any) {
        super(options);
    }
    _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding));
        callback();
    }
    getBuffer(): Buffer {
        return Buffer.concat(this.chunks);
    }
}


const ftpServerDetailsSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().int().positive("Port must be a positive integer"),
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  localPath: z.string().min(1, "Root local path is required"),
});

const monitoredFolderConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Folder name is required"),
  remotePath: z.string().min(1, "Remote path is required").refine(val => val.startsWith('/'), { message: "Remote path must start with /"}),
  interval: z.coerce.number().int().min(1, "Interval must be at least 1 minute"),
});

const appConfigSchema = z.object({
  server: ftpServerDetailsSchema,
  folders: z.array(monitoredFolderConfigSchema).min(1, "At least one monitored folder is required"),
});

export interface ActionResponse {
  success: boolean;
  message: string;
  config?: AppConfig;
  errorDetails?: Record<string, any>;
}

let isMonitoringActive = false;
let currentAppConfig: AppConfig | null = null;

export async function submitConfiguration(
  prevState: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  const rawServerData = {
    host: formData.get("host"),
    port: formData.get("port"),
    username: formData.get("username"),
    password: formData.get("password"),
    localPath: formData.get("localPath"),
  };

  const foldersJson = formData.get("foldersJson") as string | null;
  let parsedFolders: any[] = [];

  if (foldersJson) {
    try {
      parsedFolders = JSON.parse(foldersJson);
    } catch (error) {
      addFtpLog("Error parsing foldersJson: " + (error instanceof Error ? error.message : String(error)), 'error');
      return {
        success: false,
        message: "Invalid format for folder configurations.",
        errorDetails: { folders: "Could not parse folder data." },
      };
    }
  }

  const combinedConfig = {
    server: rawServerData,
    folders: parsedFolders,
  };
  
  const validationResult = appConfigSchema.safeParse(combinedConfig);

  if (!validationResult.success) {
    addFtpLog("Configuration validation failed: " + JSON.stringify(validationResult.error.flatten().fieldErrors), 'error');
    return {
      success: false,
      message: "Validation failed. Please check your inputs.",
      errorDetails: validationResult.error.flatten().fieldErrors,
    };
  }

  const newConfig = validationResult.data;
  currentAppConfig = newConfig;
  isMonitoringActive = true; 

  addFtpLog(`New configuration submitted and applied for host: ${newConfig.server.host}. Monitoring active.`, 'info');

  try {
    await fs.mkdir(path.resolve(newConfig.server.localPath), { recursive: true });
    addFtpLog(`Ensured root local path exists: ${newConfig.server.localPath}`, 'info');
  } catch (error: any) {
    addFtpLog(`Could not create/verify root local path ${newConfig.server.localPath}: ${error.message}`, 'warning');
  }

  return {
    success: true,
    message: "Configuration applied. Monitoring is active. Check FTP Activity page.",
    config: newConfig,
  };
}

export async function toggleMonitoring(start: boolean): Promise<ActionResponse> {
  if (start && !currentAppConfig) {
    isMonitoringActive = false;
    addFtpLog("Attempted to start monitoring without active configuration.", 'warning');
    return {
      success: false,
      message: "Cannot start monitoring. Configuration is missing.",
    };
  }

  isMonitoringActive = start;
  const statusMessage = start ? "Monitoring enabled." : "Monitoring disabled.";
  addFtpLog(`Monitoring explicitly ${start ? 'enabled' : 'disabled'}.`, 'info');
  
  return {
    success: true,
    message: statusMessage,
    config: currentAppConfig ?? undefined,
  };
}

export async function getAppStatusAndLogs(): Promise<{ status: 'monitoring' | 'idle' | 'error' | 'configuring' | 'connecting' | 'transferring' | 'success', logs: AppLogEntry[], config: AppConfig | null }> {
    let currentOverallStatus: 'monitoring' | 'idle' | 'error' | 'configuring' | 'connecting' | 'transferring' | 'success' = 'idle';
    if (isMonitoringActive) {
        currentOverallStatus = 'monitoring'; 
    }
    if (!currentAppConfig && isMonitoringActive) {
        currentOverallStatus = 'configuring'; 
    } else if (!currentAppConfig) {
        currentOverallStatus = 'idle';
    }
    
    await new Promise(resolve => setTimeout(resolve, 50)); 
    return {
        status: currentOverallStatus,
        logs: [...ftpOperationLogs], 
        config: currentAppConfig,
    };
}


async function saveLocalFile(
  rootLocalPath: string,
  targetSubFolder: string,
  fileName: string,
  content: Buffer
): Promise<{ success: boolean; message: string; fullPath?: string }> {
  if (!rootLocalPath || !targetSubFolder || !fileName) {
    const missingMsg = "Root local path, target subfolder, or filename missing for saving file.";
    addFtpLog(missingMsg, 'error');
    return { success: false, message: missingMsg };
  }
  try {
    const resolvedRootPath = path.resolve(rootLocalPath);
    const fullDirectoryPath = path.join(resolvedRootPath, targetSubFolder);
    
    await fs.mkdir(fullDirectoryPath, { recursive: true });
    
    const fullFilePath = path.join(fullDirectoryPath, fileName);
    await fs.writeFile(fullFilePath, content);
    
    const successMsg = `File '${fileName}' saved to ${fullDirectoryPath}.`;
    return { success: true, message: successMsg, fullPath: fullFilePath };
  } catch (error: any) {
    const errorMsg = `Failed to save file '${fileName}' to '${targetSubFolder}' in '${rootLocalPath}': ${error.message}. Check permissions.`;
    addFtpLog(errorMsg, 'error');
    return { 
      success: false, 
      message: errorMsg 
    };
  }
}


export async function fetchAndProcessFtpFolder(
    serverDetails: FtpServerDetails,
    folderConfig: MonitoredFolderConfig
): Promise<ServerFetchResponse> {
    const client = new Client(15000); 
    client.ftp.verbose = true; 
    const processedFiles: ServerFetchResponse['processedFiles'] = [];
    const logPrefix = `FTP Folder [${folderConfig.name}]:`;

    let cleanHost = serverDetails.host;
    cleanHost = cleanHost.replace(/^(ftp:\/\/|http:\/\/|https:\/\/)/i, '');
    const slashIndex = cleanHost.indexOf('/');
    if (slashIndex !== -1) {
        cleanHost = cleanHost.substring(0, slashIndex);
    }

    try {
        addFtpLog(`${logPrefix} Attempting to connect to ${cleanHost}:${serverDetails.port}`, 'info');
        await client.access({
            host: cleanHost,
            port: serverDetails.port,
            user: serverDetails.username,
            password: serverDetails.password,
            secure: false 
        });
        addFtpLog(`${logPrefix} Connected to ${cleanHost}. Navigating to remote path: ${folderConfig.remotePath}`, 'info');
        
        await client.cd(folderConfig.remotePath);
        const ftpFiles: FileInfo[] = await client.list();
        addFtpLog(`${logPrefix} Found ${ftpFiles.length} items in ${folderConfig.remotePath}.`, 'info');

        if (ftpFiles.length === 0) {
            client.close();
            return {
                success: true,
                folderName: folderConfig.name,
                message: `No files found in ${folderConfig.remotePath}.`,
                processedFiles: []
            };
        }

        let filesDownloadedCount = 0;
        for (const fileInfo of ftpFiles) {
            if (fileInfo.type === 1) { 
                const fileName = fileInfo.name;
                try {
                    addFtpLog(`${logPrefix} Attempting to download actual file: ${fileName} (${fileInfo.size} bytes)`, 'info');
                    
                    const bufferCollector = new BufferCollector();
                    await client.downloadTo(bufferCollector, fileName);
                    const buffer = bufferCollector.getBuffer();
                                        
                    addFtpLog(`${logPrefix} Successfully downloaded ${fileName} to buffer (${buffer.length} bytes).`, 'success');

                    const saveResult = await saveLocalFile(serverDetails.localPath, folderConfig.name, fileName, buffer);
                    if (saveResult.success) {
                        processedFiles.push({ name: fileName, status: 'save_success' });
                        addFtpLog(`${logPrefix} File '${fileName}' (actual content) saved successfully to ${saveResult.fullPath}.`, 'success');
                        filesDownloadedCount++;
                    } else {
                        processedFiles.push({ name: fileName, status: 'save_failed', error: saveResult.message });
                        addFtpLog(`${logPrefix} Failed to save actual file '${fileName}': ${saveResult.message}`, 'error');
                    }
                } catch (downloadError: any) {
                    let errMsg = downloadError.message || "Unknown download error";
                    if (downloadError.code) {
                        errMsg += ` (code: ${downloadError.code})`;
                    }
                    const detailedErrorMsg = `${logPrefix} Failed to download file '${fileName}'. Error: ${errMsg}.`;
                    addFtpLog(detailedErrorMsg, 'error');
                    processedFiles.push({ name: fileName, status: 'download_failed', error: errMsg });
                }
            } else if (fileInfo.type === 2) { 
                 addFtpLog(`${logPrefix} Skipping item '${fileInfo.name}', as it is a directory.`, 'info');
                 processedFiles.push({ name: fileInfo.name, status: 'skipped_isDirectory' });
            } else {
                 addFtpLog(`${logPrefix} Skipping item '${fileInfo.name}' (type: ${fileInfo.type}), not a regular file or directory.`, 'warning');
                 processedFiles.push({ name: fileInfo.name, status: 'skipped_unknown_type' });
            }
        }
        const finalMessage = `${logPrefix} Processed ${ftpFiles.length} items. Successfully downloaded and saved ${filesDownloadedCount} actual files.`;
        addFtpLog(finalMessage, filesDownloadedCount > 0 || ftpFiles.length === 0 ? 'success' : 'warning');
        client.close();
        return {
            success: true,
            folderName: folderConfig.name,
            message: finalMessage,
            processedFiles
        };

    } catch (err: any) {
        const errorMsg = `${logPrefix} Error processing FTP folder ${folderConfig.remotePath}: ${err.message} (connecting to ${cleanHost}, code: ${err.code || 'N/A'})`;
        addFtpLog(errorMsg, 'error');
        if (!client.closed) {
            client.close();
        }
        return {
            success: false,
            folderName: folderConfig.name,
            message: errorMsg,
            processedFiles, 
            error: err.message
        };
    } finally {
        if (!client.closed) {
            addFtpLog(`${logPrefix} Ensuring FTP connection is closed in finally block.`, 'info');
            await client.close(); 
        }
    }
}

export async function getLocalDirectoryListing(): Promise<LocalDirectoryResponse> {
    if (!currentAppConfig || !currentAppConfig.server.localPath) {
        addFtpLog("Cannot get local directory listing: No active configuration or local path.", 'warning');
        return { success: false, message: "No active configuration with a local path.", listing: {} };
    }

    const rootPath = path.resolve(currentAppConfig.server.localPath);
    const listing: LocalDirectoryListing = {};

    try {
        const configuredFolderNames = new Set(currentAppConfig.folders.map(f => f.name));
        const entries = await fs.readdir(rootPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory() && configuredFolderNames.has(entry.name)) {
                const folderPath = path.join(rootPath, entry.name);
                const files: (import("@/types").LocalFileEntry)[] = [];
                try {
                    const fileEntries = await fs.readdir(folderPath, { withFileTypes: true });
                    for (const fileEntry of fileEntries) {
                        if (fileEntry.isFile()) {
                            try {
                                const filePath = path.join(folderPath, fileEntry.name);
                                const stats = await fs.stat(filePath);
                                files.push({
                                    name: fileEntry.name,
                                    size: stats.size,
                                    lastModified: stats.mtime,
                                });
                            } catch (statError: any) {
                                addFtpLog(`Error stating file ${fileEntry.name} in ${entry.name}: ${statError.message}`, 'error');
                            }
                        }
                    }
                    if (files.length > 0) {
                        listing[entry.name] = files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
                    } else {
                        listing[entry.name] = []; 
                    }
                } catch (subDirError: any) {
                     addFtpLog(`Error reading subdirectory ${entry.name}: ${subDirError.message}`, 'error');
                     listing[entry.name] = []; 
                }
            }
        }
        configuredFolderNames.forEach(configuredFolderName => {
            if (!listing[configuredFolderName]) {
                listing[configuredFolderName] = [];
            }
        });

        addFtpLog("Successfully retrieved local directory listing.", 'info');
        return { success: true, listing };
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            addFtpLog(`Root local directory not found: ${rootPath}. It might be created on first download.`, 'info');
            const emptyListing: LocalDirectoryListing = {};
            currentAppConfig.folders.forEach(folder => {
                emptyListing[folder.name] = [];
            });
            return { success: true, listing: emptyListing, message: "Root local directory not found, will be created." };
        }
        addFtpLog(`Error reading local directory ${rootPath}: ${error.message}`, 'error');
        return { success: false, error: `Failed to read local directory: ${error.message}`, listing: {} };
    }
}


export async function downloadLocalFile(folderName: string, fileName: string): Promise<DownloadLocalFileResponse> {
  if (!currentAppConfig || !currentAppConfig.server.localPath) {
    return { success: false, error: "Application not configured for local file access." };
  }

  const rootLocalPath = path.resolve(currentAppConfig.server.localPath);
  const targetFilePath = path.resolve(rootLocalPath, folderName, fileName);

  if (!targetFilePath.startsWith(rootLocalPath + path.sep)) {
    addFtpLog(`Security Alert: Attempt to access file outside of configured root path. Requested: ${targetFilePath}`, 'error');
    return { success: false, error: "Access denied: File path is outside the allowed directory." };
  }

  try {
    await fs.access(targetFilePath, fsConstants.F_OK); 
    const fileBuffer = await fs.readFile(targetFilePath);
    
    let contentType = 'application/octet-stream';
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.txt' || ext === '.dat') {
      contentType = 'text/plain';
    } else if (ext === '.json') {
      contentType = 'application/json';
    } else if (ext === '.xml') {
        contentType = 'application/xml';
    } else if (ext === '.pdf') {
        contentType = 'application/pdf';
    } else if (ext === '.png') {
        contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
    } else if (ext === '.gif') {
        contentType = 'image/gif';
    }

    addFtpLog(`Preparing download for local file: ${targetFilePath}`, 'info');
    return { 
      success: true, 
      data: fileBuffer, 
      contentType: contentType,
      fileName: fileName 
    };

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      addFtpLog(`File not found for download: ${targetFilePath}`, 'error');
      return { success: false, error: "File not found." };
    }
    addFtpLog(`Error reading file for download ${targetFilePath}: ${error.message}`, 'error');
    return { success: false, error: `Could not read file: ${error.message}` };
  }
}

// --- User Management Actions ---

export interface UserActionResponse {
  success: boolean;
  message: string;
  user?: User;
  users?: User[];
  roles?: string[]; // For getRolesAction
  stations?: string[]; // For getStationsAction
  error?: string;
}

// Zod schema for server-side validation of user creation data
const createUserServerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  // confirmPassword is not needed by the server action itself, only for client-side form validation
  role: z.string().min(1, "Role is required."), // Validated against DB if necessary during action
  station: z.string().min(1, "Station is required."), // Validated against DB if necessary
});


export async function createUserAction(formData: FormData): Promise<UserActionResponse> {
  const rawData = {
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
    station: formData.get('station'),
  };

  const validationResult = createUserServerSchema.safeParse(rawData);

  if (!validationResult.success) {
    return { success: false, message: "Validation failed on server.", error: JSON.stringify(validationResult.error.flatten().fieldErrors) };
  }

  const { username, email, password, role, station } = validationResult.data;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    // Optionally, validate role and station against their respective collections here
    // For example:
    // const roleExists = await db.collection('roles').findOne({ name: role });
    // if (!roleExists) return { success: false, message: "Invalid role selected." };

    const existingUser = await usersCollection.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return { success: false, message: "User with this email or username already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUserDocument: UserDocument = {
      username,
      email,
      hashedPassword,
      roles: [role as UserRole], // Assuming role string is a valid UserRole
      station,
      createdAt: new Date(),
      status: 'active', 
    };

    const result = await usersCollection.insertOne(newUserDocument);

    if (!result.insertedId) {
      return { success: false, message: "Failed to create user in database." };
    }
    
    const createdUser: User = {
        id: result.insertedId.toString(),
        username: newUserDocument.username,
        email: newUserDocument.email,
        roles: newUserDocument.roles,
        createdAt: newUserDocument.createdAt,
        status: newUserDocument.status,
        station: newUserDocument.station
    };

    return { success: true, message: "User created successfully.", user: createdUser };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return { success: false, message: "Server error while creating user.", error: error.message };
  }
}

export async function getUsersAction(): Promise<UserActionResponse> {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    
    const userDocuments = await usersCollection.find({}, { projection: { hashedPassword: 0 } }).toArray();
    
    const users: User[] = userDocuments.map(doc => ({
      id: doc._id!.toString(), 
      username: doc.username,
      email: doc.email,
      roles: doc.roles,
      createdAt: doc.createdAt,
      status: doc.status,
      station: doc.station,
    }));

    return { success: true, message: "Users fetched successfully.", users };
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return { success: false, message: "Server error while fetching users.", error: error.message };
  }
}

export async function deleteUserAction(userId: string): Promise<UserActionResponse> {
  if (!ObjectId.isValid(userId)) {
    return { success: false, message: "Invalid user ID format." };
  }
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

    if (result.deletedCount === 0) {
      return { success: false, message: "User not found or already deleted." };
    }
    return { success: true, message: "User deleted successfully." };
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return { success: false, message: "Server error while deleting user.", error: error.message };
  }
}

export async function getRolesAction(): Promise<UserActionResponse> {
  try {
    const { db } = await connectToDatabase();
    const rolesCollection = db.collection<{ name: string }>('roles'); // Assuming roles docs have a 'name' field
    const roleDocuments = await rolesCollection.find({}).toArray();
    const roles = roleDocuments.map(doc => doc.name);
    return { success: true, message: "Roles fetched successfully.", roles };
  } catch (error: any) {
    console.error("Error fetching roles:", error);
    return { success: false, message: "Server error while fetching roles.", error: error.message, roles: [] };
  }
}

export async function getStationsAction(): Promise<UserActionResponse> {
  try {
    const { db } = await connectToDatabase();
    const stationsCollection = db.collection<{ name: string }>('stations'); // Assuming station docs have a 'name' field
    const stationDocuments = await stationsCollection.find({}).toArray();
    const stations = stationDocuments.map(doc => doc.name);
    return { success: true, message: "Stations fetched successfully.", stations };
  } catch (error: any) {
    console.error("Error fetching stations:", error);
    return { success: false, message: "Server error while fetching stations.", error: error.message, stations: [] };
  }
}

// --- Auth Actions ---

const loginSchema = z.object({
    email: z.string().email("Invalid email address."),
    password: z.string().min(1, "Password is required."),
});

export async function loginAction(prevState: any, formData: FormData): Promise<{ message: string; }> {
    const validatedFields = loginSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    });

    if (!validatedFields.success) {
        return { message: "Invalid email or password format." };
    }
    
    const { email, password } = validatedFields.data;

    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection<UserDocument>('users');
        const user = await usersCollection.findOne({ email });

        if (!user || !user.hashedPassword) {
            return { message: "Invalid credentials." };
        }

        const passwordsMatch = await bcrypt.compare(password, user.hashedPassword);

        if (!passwordsMatch) {
            return { message: "Invalid credentials." };
        }

        await createSession(user._id!.toString(), user.username, user.roles);

    } catch (error) {
        console.error("Login error:", error);
        return { message: "An error occurred during login." };
    }

    redirect('/'); // Redirect to dashboard on successful login
}

export async function logoutAction() {
    await deleteSession();
    redirect('/login');
}
