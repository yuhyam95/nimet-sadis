"use server";

import type { AppConfig, FtpServerDetails, MonitoredFolderConfig, FetchedFileEntry, LogEntry as AppLogEntry, FetchFtpFolderResponse as ServerFetchResponse } from "@/types";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { Client, FileInfo } from 'basic-ftp';

// Server-side log store for FTP operations
const ftpOperationLogs: AppLogEntry[] = [];
const MAX_FTP_LOGS = 200; // Keep the last 200 logs

// Helper function to add logs to the server-side store
function addFtpLog(message: string, type: AppLogEntry['type']) {
  const newLog: AppLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    message,
    type,
  };
  ftpOperationLogs.unshift(newLog); // Add to the beginning of the array
  if (ftpOperationLogs.length > MAX_FTP_LOGS) {
    ftpOperationLogs.length = MAX_FTP_LOGS; // Trim to max size
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

// Renamed from FetchFtpFolderResponse in types to avoid conflict here.
// This is the type for the server action's return.
// export interface FetchFtpFolderResponse {
//     success: boolean;
//     message: string;
//     folderName: string;
//     processedFiles: { name: string; status: 'simulated_save_success' | 'simulated_save_failed' | 'download_success' | 'download_failed'; error?: string }[];
//     error?: string;
// }


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
    addFtpLog("Configuration validation failed.", 'error');
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
    // Determine a more granular status if possible
    let currentOverallStatus: 'monitoring' | 'idle' | 'error' | 'configuring' | 'connecting' | 'transferring' | 'success' = 'idle';
    if (isMonitoringActive) {
        currentOverallStatus = 'monitoring'; // Default to monitoring if active
    }
    if (!currentAppConfig && isMonitoringActive) {
        currentOverallStatus = 'configuring'; // Misconfigured state?
    } else if (!currentAppConfig) {
        currentOverallStatus = 'idle';
    }
    // More complex status logic could be added here if actions update a global server status variable

    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate small delay
    return {
        status: currentOverallStatus,
        logs: [...ftpOperationLogs], // Return a copy of the server logs
        config: currentAppConfig,
    };
}


async function saveLocalFile(
  rootLocalPath: string,
  targetSubFolder: string,
  fileName: string,
  content: string | Buffer // Can now be string or Buffer for real files
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
    // If content is string, it's utf-8. If it's Buffer, write as is.
    await fs.writeFile(fullFilePath, content, typeof content === 'string' ? 'utf-8' : undefined);
    
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
    const client = new Client();
    client.ftp.verbose = true; // Enable verbose logging for basic-ftp for now
    const processedFiles: ServerFetchResponse['processedFiles'] = [];
    const logPrefix = `FTP Folder [${folderConfig.name}]:`;

    let cleanHost = serverDetails.host;
    // Remove protocol if present (e.g., ftp://, http://, https://)
    cleanHost = cleanHost.replace(/^(ftp:\/\/|http:\/\/|https:\/\/)/i, '');
    // Remove any path or trailing slashes after the hostname
    const slashIndex = cleanHost.indexOf('/');
    if (slashIndex !== -1) {
        cleanHost = cleanHost.substring(0, slashIndex);
    }


    try {
        addFtpLog(`${logPrefix} Attempting to connect to ${cleanHost}:${serverDetails.port} (original host input: ${serverDetails.host})`, 'info');
        await client.access({
            host: cleanHost,
            port: serverDetails.port,
            user: serverDetails.username,
            password: serverDetails.password,
            secure: false // For plain FTP. Change to true or 'implicit' for FTPS if needed.
        });
        addFtpLog(`${logPrefix} Connected to ${cleanHost}. Navigating to remote path: ${folderConfig.remotePath}`, 'info');
        
        await client.cd(folderConfig.remotePath);
        const ftpFiles: FileInfo[] = await client.list();
        addFtpLog(`${logPrefix} Found ${ftpFiles.length} files/folders in ${folderConfig.remotePath}.`, 'info');

        if (ftpFiles.length === 0) {
            client.close();
            return {
                success: true,
                folderName: folderConfig.name,
                message: `No files found in ${folderConfig.remotePath}.`,
                processedFiles: []
            };
        }

        for (const fileInfo of ftpFiles) {
            if (fileInfo.type === 1) { // Type 1 is usually a file
                const fileName = fileInfo.name;
                // Placeholder content for now, using the real filename
                const placeholderContent = `Placeholder for REAL file: ${fileName}\nFrom FTP folder: ${folderConfig.remotePath}\nListed at: ${new Date().toISOString()}\nThis placeholder confirms the file was listed on the FTP server. Actual content download is the next step.`;
                
                const saveResult = await saveLocalFile(serverDetails.localPath, folderConfig.name, fileName, placeholderContent);
                if (saveResult.success) {
                    processedFiles.push({ name: fileName, status: 'simulated_save_success' }); // Using 'simulated_save_success' as content is still placeholder
                    addFtpLog(`${logPrefix} Placeholder for file '${fileName}' saved successfully to local path.`, 'success');
                } else {
                    processedFiles.push({ name: fileName, status: 'simulated_save_failed', error: saveResult.message });
                    addFtpLog(`${logPrefix} Failed to save placeholder for file '${fileName}': ${saveResult.message}`, 'error');
                }
            }
        }
        const finalMessage = `${logPrefix} Listed ${ftpFiles.length} items. Processed ${processedFiles.length} files (as placeholders).`;
        addFtpLog(finalMessage, processedFiles.some(f => f.status === 'simulated_save_failed') ? 'warning' : 'success');
        client.close();
        return {
            success: true,
            folderName: folderConfig.name,
            message: finalMessage,
            processedFiles
        };

    } catch (err: any) {
        const errorMsg = `${logPrefix} Error processing FTP folder ${folderConfig.remotePath}: ${err.message} (connecting to ${cleanHost})`;
        addFtpLog(errorMsg, 'error');
        if (!client.closed) {
            client.close();
        }
        return {
            success: false,
            folderName: folderConfig.name,
            message: errorMsg,
            processedFiles, // Include any files processed before the error
            error: err.message
        };
    } finally {
        // Ensure client is closed, even if an error occurred before explicit close
        if (!client.closed) {
            addFtpLog(`${logPrefix} Ensuring FTP connection is closed in finally block.`, 'info');
            await client.close();
        }
    }
}
    
