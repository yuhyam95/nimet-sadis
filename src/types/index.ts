
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

// This type represents individual entries in the fetched files list on the client
export interface FetchedFileEntry {
  folderName: string; // The name of the MonitoredFolderConfig (e.g., "Satellite Images")
  fileName: string;
  timestamp: Date;
}
