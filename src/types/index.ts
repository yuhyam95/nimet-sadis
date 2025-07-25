
import type { ObjectId } from 'mongodb';

export interface AppConfig {
  opmetPath: string;
  sigwxPath: string;
  griddedPath: string;
  vaaPath: string;
}

export interface LatestFileEntry {
  name: string;
  product: string;
  lastModified: Date;
  relativePath: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export type AppStatus = 'idle' | 'error' | 'ok';

export interface LocalFileEntry {
  name: string;
  size: number; // in bytes
  lastModified: Date;
}

export interface DirectoryContent {
    files: LocalFileEntry[];
    folders: string[];
}

export interface DirectoryContentResponse {
    success: boolean;
    content?: DirectoryContent;
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
