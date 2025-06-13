
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

// This type represents individual entries in the fetched files list on the client (DEPRECATED by LocalDirectoryListing for FetchedFilesList)
export interface FetchedFileEntry {
  folderName: string; 
  fileName: string;
  timestamp: Date;
}

// Response from the server action that processes an FTP folder
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

// Types for displaying local directory content
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
  data?: Buffer; // File content as Buffer
  contentType?: string;
  fileName?: string;
  error?: string; 
}

// User Management Types
export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  username: string;
  email: string;
  roles: UserRole[];
  createdAt: Date;
  status: 'active' | 'invited' | 'suspended';
}
    
