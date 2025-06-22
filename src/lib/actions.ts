
"use server";

import type { AppConfig, LogEntry as AppLogEntry, DirectoryContent, DirectoryContentResponse, DownloadLocalFileResponse, User, UserDocument, UserRole, LocalFileEntry } from "@/types";
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

export async function getProductDirectoryListing(productKey: string, subPath: string = ''): Promise<DirectoryContentResponse> {
  if (!currentAppConfig) {
    return { success: false, error: "Application not configured." };
  }

  const pathKey = `${productKey}Path`;
  const basePath = (currentAppConfig as any)[pathKey];

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
    files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    
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
