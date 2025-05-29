export interface FtpConfig {
  host: string;
  port: number;
  username: string;
  password?: string; // Password might be optional if anonymous FTP or saved elsewhere
  remotePath: string;
  localPath: string;
  interval: number; // in minutes
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export type AppStatus = 'idle' | 'configuring' | 'monitoring' | 'error' | 'connecting' | 'transferring' | 'success';

// Helper for form validation
export interface ConfigFormData extends Omit<FtpConfig, 'port' | 'interval'> {
  port: string; // Port will be string from form input, then parsed
  interval: string; // Interval will be string from form input, then parsed
}
