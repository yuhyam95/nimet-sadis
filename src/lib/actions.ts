"use server";

import type { AppConfig, LogEntry as AppLogEntry, DirectoryContent, DirectoryContentResponse, DownloadLocalFileResponse, User, UserDocument, UserRole, LocalFileEntry, LatestFileEntry } from "@/types";
import { z } from "zod";
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { connectToDatabase } from './db';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { createSession, deleteSession, getSession } from './auth';
// import { getSessionToken, setSessionToken } from './session-client'; // Removed session-client import
import { redirect } from 'next/navigation';

const operationLogs: AppLogEntry[] = [];
const MAX_LOGS = 200; 

function addLog(message: string, type: AppLogEntry['type']) {
  const newLog: AppLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    message,
    type, 
  };
  operationLogs.unshift(newLog); 
  if (operationLogs.length > MAX_LOGS) {
    operationLogs.length = MAX_LOGS; 
  }
}

const appConfigSchema = z.object({
  opmetPath: z.string().min(1, "OPMET path is required."),
  sigwxPath: z.string().min(1, "SIGWX path is required."),
  griddedPath: z.string().min(1, "GRIDDED path is required."),
  vaaPath: z.string().min(1, "VAA path is required."),
});


export interface ActionResponse {
  success: boolean;
  message: string;
  config?: AppConfig;
  errorDetails?: Record<string, any>;
}

let currentAppConfig: AppConfig | null = null;
const defaultPaths: AppConfig = {
    opmetPath: '/home/nimet/SADIS-Visualization/Latest_Outputs/OPMET',
    sigwxPath: '/home/nimet/SADIS-Visualization/Latest_Outputs/SIGWX',
    griddedPath: '/home/nimet/SADIS-Visualization/Latest_Outputs/GRIDDED',
    vaaPath: '/home/nimet/SADIS-Visualization/Latest_Outputs/VAA',
};
if (!currentAppConfig) {
    currentAppConfig = defaultPaths;
}

export async function submitConfiguration(
  prevState: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    opmetPath: formData.get("opmetPath"),
    sigwxPath: formData.get("sigwxPath"),
    griddedPath: formData.get("griddedPath"),
  };
  
  const validationResult = appConfigSchema.safeParse(rawData);

  if (!validationResult.success) {
    addLog("Configuration validation failed.", 'error');
    return {
      success: false,
      message: "Validation failed. Please check your inputs.",
      errorDetails: validationResult.error.flatten().fieldErrors,
    };
  }

  const newConfig = validationResult.data;
  currentAppConfig = newConfig;

  addLog(`New local folder configuration saved.`, 'success');

  try {
      for (const pathValue of Object.values(newConfig)) {
          await fs.mkdir(path.resolve(pathValue), { recursive: true });
      }
      addLog('Verified all configured local directories exist.', 'info');
  } catch (error: any) {
      addLog(`Could not create/verify a local directory: ${error.message}`, 'warning');
  }


  return {
    success: true,
    message: "Configuration saved successfully.",
    config: newConfig,
  };
}

export async function getAppStatusAndLogs(): Promise<{ status: 'idle' | 'ok' | 'error', logs: AppLogEntry[], config: AppConfig | null }> {
    await new Promise(resolve => setTimeout(resolve, 50)); 
    return {
        status: currentAppConfig ? 'ok' : 'idle',
        logs: [...operationLogs], 
        config: currentAppConfig,
    };
}

export async function getProductDirectoryListing(productKey: string, subPath: string = ''): Promise<DirectoryContentResponse> {
  if (!currentAppConfig) {
    return { success: false, error: "Application not configured." };
  }

  // Map productKey to config key
  const productKeyMap: Record<string, keyof AppConfig> = {
    opmet: 'opmetPath',
    sigwx: 'sigwxPath',
    gridded: 'griddedPath',
    vaa: 'vaaPath',
  };
  const configKey = productKeyMap[productKey];
  const basePath = configKey ? currentAppConfig[configKey] : undefined;

  if (!basePath) {
    return { success: false, error: `No path configured for product: ${productKey}` };
  }

  const resolvedBasePath = path.resolve(basePath);
  const targetPath = path.join(resolvedBasePath, subPath);
  const resolvedTargetPath = path.resolve(targetPath);

  if (!resolvedTargetPath.startsWith(resolvedBasePath)) {
    addLog(`Security Alert: Attempt to access path outside of configured directory. Requested: ${resolvedTargetPath}`, 'error');
    return { success: false, error: "Access denied: Path is outside the allowed directory." };
  }

  try {
    await fs.access(resolvedTargetPath, fsConstants.F_OK);
    const entries = await fs.readdir(resolvedTargetPath, { withFileTypes: true });
    const files: LocalFileEntry[] = [];
    const folders: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(resolvedTargetPath, entry.name);
      if (entry.isDirectory()) {
        folders.push(entry.name);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(entryPath);
          files.push({
            name: entry.name,
            size: stats.size,
            lastModified: stats.mtime,
          });
        } catch (statError: any) {
          addLog(`Error stating file ${entry.name} in ${resolvedTargetPath}: ${statError.message}`, 'error');
        }
      }
    }
    
    folders.sort((a, b) => a.localeCompare(b));
    // files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()); // Removed sorting to preserve directory order
    
    return { success: true, content: { files, folders } };

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      addLog(`Directory not found for ${productKey} at path ${resolvedTargetPath}.`, 'warning');
      return { success: false, error: "Directory not found. Please check configuration and ensure the path exists." };
    }
    addLog(`Error reading directory for ${productKey} at ${resolvedTargetPath}: ${error.message}`, 'error');
    return { success: false, error: `Error reading directory: ${error.message}` };
  }
}


export async function downloadLocalFile(productKey: string, filePath: string): Promise<DownloadLocalFileResponse> {
  if (!currentAppConfig) {
    return { success: false, error: "Application not configured for local file access." };
  }

  const pathKey = `${productKey}Path` as keyof AppConfig;
  const basePath = currentAppConfig[pathKey];

  if (!basePath) {
      return { success: false, error: `No path configured for product: ${productKey}` };
  }

  const resolvedBasePath = path.resolve(basePath);
  const targetFilePath = path.join(resolvedBasePath, filePath);
  const resolvedTargetFilePath = path.resolve(targetFilePath);

  if (!resolvedTargetFilePath.startsWith(resolvedBasePath)) {
    addLog(`Security Alert: Attempt to access file outside of configured path. Requested: ${resolvedTargetFilePath}`, 'error');
    return { success: false, error: "Access denied: File path is outside the allowed directory." };
  }

  try {
    await fs.access(resolvedTargetFilePath, fsConstants.F_OK); 
    const fileBuffer = await fs.readFile(resolvedTargetFilePath);
    const fileName = path.basename(filePath);
    
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

    addLog(`Preparing download for local file: ${resolvedTargetFilePath}`, 'info');
    return { 
      success: true, 
      data: fileBuffer, 
      contentType: contentType,
      fileName: fileName 
    };

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      addLog(`File not found for download: ${resolvedTargetFilePath}`, 'error');
      return { success: false, error: "File not found." };
    }
    addLog(`Error reading file for download ${resolvedTargetFilePath}: ${error.message}`, 'error');
    return { success: false, error: `Could not read file: ${error.message}` };
  }
}

async function recursivelyFindFiles(directory: string, productKey: string, basePath: string): Promise<LatestFileEntry[]> {
    let files: LatestFileEntry[] = [];
    try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                files = files.concat(await recursivelyFindFiles(fullPath, productKey, basePath));
            } else if (entry.isFile()) {
                const stats = await fs.stat(fullPath);
                files.push({
                    name: entry.name,
                    product: productKey,
                    lastModified: stats.mtime,
                    relativePath: path.relative(basePath, fullPath)
                });
            }
        }
    } catch (error) {
        addLog(`Error scanning directory ${directory}: ${(error as Error).message}`, 'warning');
    }
    return files;
}

export async function getLatestFiles(page = 1, pageSize = 10): Promise<{ success: boolean; files?: LatestFileEntry[]; totalCount?: number; error?: string }> {
  if (!currentAppConfig) {
    return { success: false, error: "Application not configured." };
  }

  let allFiles: LatestFileEntry[] = [];

  const productPaths = {
    opmet: currentAppConfig.opmetPath,
    sigwx: currentAppConfig.sigwxPath,
    gridded: currentAppConfig.griddedPath,
    vaa: currentAppConfig.vaaPath
  };

  for (const [productKey, basePath] of Object.entries(productPaths)) {
    if (basePath) {
      const resolvedBasePath = path.resolve(basePath);
      try {
        await fs.access(resolvedBasePath, fsConstants.F_OK);
        const productFiles = await recursivelyFindFiles(resolvedBasePath, productKey, resolvedBasePath);
        allFiles.push(...productFiles);
      } catch (err) {
        addLog(`Directory for product ${productKey} at ${resolvedBasePath} not found or inaccessible.`, 'info');
      }
    }
  }

  allFiles.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  const totalCount = allFiles.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pagedFiles = allFiles.slice(start, end);

  return { success: true, files: pagedFiles, totalCount };
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
  role: z.string().min(1, "Role is required."),
  station: z.string().min(1, "Station is required."),
});

function toUserRoles(roles: string[]): UserRole[] {
  const validRoles: UserRole[] = ['admin', 'airport manager', 'meteorologist'];
  return roles.filter((role): role is UserRole => validRoles.includes(role as UserRole));
}

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

    const existingUser = await usersCollection.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return { success: false, message: "User with this email or username already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUserDocument: UserDocument = {
      username,
      email,
      hashedPassword,
      roles: [role as UserRole], 
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
        roles: toUserRoles(newUserDocument.roles),
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
      roles: toUserRoles(doc.roles || []),
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
    const rolesCollection = db.collection<{ name: string }>('roles');
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
    const stationsCollection = db.collection<{ name: string }>('stations');
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

export async function loginAction(formData: FormData): Promise<{ success: boolean; message: string; token?: string } | void> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  const url = `https://edms.nimet.gov.ng/api/sadis/verifyuser`;
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // Remove encryption: Pass credentials directly
    body: JSON.stringify({ Username: username, Password: password }),
  };
  // Attach Authorization header if token exists (client-side)
  // if (typeof window !== 'undefined') {
  //   const token = getSessionToken();
  //   if (token) {
  //     (fetchOptions.headers as any)['Authorization'] = `Bearer ${token}`;
  //   }
  // } // Removed token logic
  console.log('Fetch URL:', url);
  console.log('Fetch options:', fetchOptions);

  try {
    const response = await fetch(url, fetchOptions); // POST with JSON body
    console.log('Login: Response status', response.status);

    const rawText = await response.text();
    console.log('Login: Raw response text:', rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (jsonErr) {
      console.error('Login: Failed to parse JSON:', jsonErr);
      return { success: false, message: "Invalid response from authentication server." };
    }

    console.log('External login API response:', data);

    if (!data.IsSuccess) {
      console.error('Login failed: ', data.Message);
      return { success: false, message: data.Message || "Invalid credentials." };
    }

    // Authentication successful, no need to create/set session token locally
    const result = { success: true, message: "Login successful." }; // Removed token from result
    console.log('loginAction result:', result);
    return result;
  } catch (error) {
    console.error('Login: Exception occurred', error);
    return { success: false, message: "An error occurred during login." };
  }
}

export async function logoutAction() {
    await deleteSession();
    // Add a small delay to ensure the cookie is deleted before redirect
    await new Promise(resolve => setTimeout(resolve, 100));
    redirect('/login');
}

// Get user settings (any user)
export async function getUserSettings(userId: string) {
  const { db } = await connectToDatabase();
  const doc = await db.collection('user_settings').findOne({ userId });
  return doc?.configuration || null;
}

// Set user settings (admin only)
export async function setUserSettings(userId: string, configuration: any) {
  const session = await getSession();
  if (!session || !session.roles || !session.roles.includes('admin')) {
    throw new Error('Unauthorized: Only admin can set user settings.');
  }
  const { db } = await connectToDatabase();
  await db.collection('user_settings').updateOne(
    { userId },
    { $set: { configuration } },
    { upsert: true }
  );
  return { success: true };
}
