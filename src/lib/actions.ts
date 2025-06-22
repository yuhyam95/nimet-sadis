
"use server";

import type { AppConfig, LogEntry as AppLogEntry, LocalDirectoryListing, LocalDirectoryResponse, DownloadLocalFileResponse, User, UserDocument, UserRole } from "@/types";
import { z } from "zod";
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { connectToDatabase } from './db';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { createSession, deleteSession } from './auth';
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
  sigmetPath: z.string().min(1, "SIGMET path is required."),
  volcanicAshPath: z.string().min(1, "Volcanic Ash path is required."),
  tropicalCyclonePath: z.string().min(1, "Tropical Cyclone path is required."),
});


export interface ActionResponse {
  success: boolean;
  message: string;
  config?: AppConfig;
  errorDetails?: Record<string, any>;
}

let currentAppConfig: AppConfig | null = null;
const defaultPaths: AppConfig = {
    opmetPath: 'local_storage/opmet',
    sigmetPath: 'local_storage/sigmet',
    volcanicAshPath: 'local_storage/volcanic_ash',
    tropicalCyclonePath: 'local_storage/tropical_cyclone',
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
    sigmetPath: formData.get("sigmetPath"),
    volcanicAshPath: formData.get("volcanicAshPath"),
    tropicalCyclonePath: formData.get("tropicalCyclonePath"),
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


export async function getLocalDirectoryListing(): Promise<LocalDirectoryResponse> {
    if (!currentAppConfig) {
        addLog("Cannot get local directory listing: No active configuration.", 'warning');
        return { success: false, message: "No active configuration.", listing: {} };
    }

    const listing: LocalDirectoryListing = {};
    const pathMapping = {
        'OPMET Products': currentAppConfig.opmetPath,
        'SIGMET Products': currentAppConfig.sigmetPath,
        'Volcanic Ash Products': currentAppConfig.volcanicAshPath,
        'Tropical Cyclone Products': currentAppConfig.tropicalCyclonePath,
    };

    for (const [productName, productPath] of Object.entries(pathMapping)) {
        try {
            const resolvedPath = path.resolve(productPath);
            const files: (import("@/types").LocalFileEntry)[] = [];
            const fileEntries = await fs.readdir(resolvedPath, { withFileTypes: true });

            for (const fileEntry of fileEntries) {
                if (fileEntry.isFile()) {
                    try {
                        const filePath = path.join(resolvedPath, fileEntry.name);
                        const stats = await fs.stat(filePath);
                        files.push({
                            name: fileEntry.name,
                            size: stats.size,
                            lastModified: stats.mtime,
                        });
                    } catch (statError: any) {
                        addLog(`Error stating file ${fileEntry.name} in ${productName} folder: ${statError.message}`, 'error');
                    }
                }
            }
            listing[productName] = files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                addLog(`Directory not found for ${productName}: ${productPath}. It might be created on config save.`, 'info');
                listing[productName] = [];
            } else {
                addLog(`Error reading directory for ${productName} (${productPath}): ${error.message}`, 'error');
                listing[productName] = [];
            }
        }
    }
    
    addLog("Successfully retrieved local directory listing.", 'info');
    return { success: true, listing };
}


export async function downloadLocalFile(folderName: string, fileName: string): Promise<DownloadLocalFileResponse> {
  if (!currentAppConfig) {
    return { success: false, error: "Application not configured for local file access." };
  }

  const pathMapping: { [key: string]: string | undefined } = {
        'OPMET Products': currentAppConfig.opmetPath,
        'SIGMET Products': currentAppConfig.sigmetPath,
        'Volcanic Ash Products': currentAppConfig.volcanicAshPath,
        'Tropical Cyclone Products': currentAppConfig.tropicalCyclonePath
    };
  
  const basePath = pathMapping[folderName];

  if (!basePath) {
      return { success: false, error: `No path configured for folder: ${folderName}` };
  }

  const resolvedBasePath = path.resolve(basePath);
  const targetFilePath = path.resolve(resolvedBasePath, fileName);

  if (!targetFilePath.startsWith(resolvedBasePath + path.sep)) {
    addLog(`Security Alert: Attempt to access file outside of configured path. Requested: ${targetFilePath}`, 'error');
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

    addLog(`Preparing download for local file: ${targetFilePath}`, 'info');
    return { 
      success: true, 
      data: fileBuffer, 
      contentType: contentType,
      fileName: fileName 
    };

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      addLog(`File not found for download: ${targetFilePath}`, 'error');
      return { success: false, error: "File not found." };
    }
    addLog(`Error reading file for download ${targetFilePath}: ${error.message}`, 'error');
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
  role: z.string().min(1, "Role is required."),
  station: z.string().min(1, "Station is required."),
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

export async function loginAction(formData: FormData): Promise<{ success: false; message: string } | void> {
    const validatedFields = loginSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    });

    if (!validatedFields.success) {
        return { success: false, message: "Invalid email or password format." };
    }
    
    const { email, password } = validatedFields.data;

    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection<UserDocument>('users');
        const user = await usersCollection.findOne({ email });

        if (!user || !user.hashedPassword) {
            return { success: false, message: "Invalid credentials." };
        }

        const passwordsMatch = await bcrypt.compare(password, user.hashedPassword);

        if (!passwordsMatch) {
            return { success: false, message: "Invalid credentials." };
        }

        await createSession(user._id!.toString(), user.username, user.roles);

    } catch (error) {
        console.error("Login error:", error);
        return { success: false, message: "An error occurred during login." };
    }

    redirect('/');
}

export async function logoutAction() {
    await deleteSession();
    redirect('/login');
}
