
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
  content: string | Buffer 
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
    const client = new Client(15000); // 15 second timeout for FTP operations
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
            secure: false // For plain FTP. Use true for explicit FTPS (AUTH TLS), or 'implicit' for implicit FTPS.
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
            if (fileInfo.type === 1) { // Type 1 is File
                const fileName = fileInfo.name;
                try {
                    addFtpLog(`${logPrefix} Attempting to download actual file: ${fileName} (${fileInfo.size} bytes)`, 'info');
                    const buffer = await client.downloadToBuffer(fileName); 
                    addFtpLog(`${logPrefix} Successfully downloaded ${fileName} to buffer (${buffer.length} bytes).`, 'info');

                    const saveResult = await saveLocalFile(serverDetails.localPath, folderConfig.name, fileName, buffer);
                    if (saveResult.success) {
                        processedFiles.push({ name: fileName, status: 'download_success' });
                        addFtpLog(`${logPrefix} File '${fileName}' (actual content) saved successfully to ${saveResult.fullPath}.`, 'success');
                        filesDownloadedCount++;
                    } else {
                        processedFiles.push({ name: fileName, status: 'download_failed', error: saveResult.message });
                        addFtpLog(`${logPrefix} Failed to save actual file '${fileName}': ${saveResult.message}`, 'error');
                    }
                } catch (downloadError: any) {
                    const downloadErrorMsg = `${logPrefix} Failed to download file '${fileName}': ${downloadError.message}`;
                    addFtpLog(downloadErrorMsg, 'error');
                    processedFiles.push({ name: fileName, status: 'download_failed', error: downloadError.message });
                }
            } else if (fileInfo.type === 2) { // Type 2 is Directory
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
            await client.close(); // Ensure closure
        }
    }
}
