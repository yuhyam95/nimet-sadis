
import type { ObjectId } from 'mongodb';

export interface FtpServerDetails {
  host: string;
  port: number;
  username: string;
  password?: string;
  localPath: string; // Root local path for all downloads
}

export interface MonitoredFolderConfig {
  id: string; // For useFieldArray key and tracking
  name: string; // User-friendly name for this folder configuration
  remotePath: string;
  interval: number; // Polling interval in minutes for this specific folder
}

export interface AppConfig {
  server: FtpServerDetails;
  folders: MonitoredFolderConfig[];
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export type AppStatus = 'idle' | 'configuring' | 'monitoring' | 'error' | 'connecting' | 'transferring' | 'success';

export interface FetchFtpFolderResponse {
    success: boolean;
    message: string;
    folderName: string;
    processedFiles: { 
        name: string; 
        status: 'download_success' | 'download_failed' | 'skipped_isDirectory' | 'skipped_unknown_type' | 'save_success' | 'save_failed' | 'simulated_save_success'; 
        error?: string 
    }[];
    error?: string; 
}

export interface LocalFileEntry {
  name: string;
  size: number; // in bytes
  lastModified: Date;
}

export interface LocalDirectoryListing {
  [folderName: string]: LocalFileEntry[];
}

export interface LocalDirectoryResponse {
  success: boolean;
  listing?: LocalDirectoryListing;
  message?: string;
  error?: string;
}

export interface DownloadLocalFileResponse {
  success: boolean;
  data?: Buffer | { type: 'Buffer', data: number[] }; 
  contentType?: string;
  fileName?: string;
  error?: string; 
}

// User Management Types
export type UserRole = "admin" | "airport manager" | "meteorologist";

// Type for User data sent to the client (omits password)
export interface User {
  id: string; // string representation of MongoDB _id
  username: string;
  email: string;
  roles: UserRole[];
  createdAt: Date;
  status: 'active' | 'invited' | 'suspended';
  station?: string; 
}

// Type for User document in MongoDB (includes hashed password)
export interface UserDocument extends Omit<User, 'id' | 'roles'> { // roles here will be string[] from DB.
  _id?: ObjectId; // MongoDB ObjectId
  hashedPassword?: string; // Store hashed password, not plain text
  roles: string[]; // In DB, roles are stored as an array of strings. UserRole type is for client-side type safety.
}

export interface SessionPayload {
  userId: string;
  username: string;
  roles: string[];
}


// If you need more complex Role or Station objects in the future:
// export interface Role {
//   _id?: ObjectId;
//   name: string;
//   permissions?: string[];
// }

// export interface Station {
//   _id?: ObjectId;
//   name: string;
//   code?: string;
//   location?: { lat: number, lon: number };
// }
