
"use server";

import type { AppConfig, FtpServerDetails, MonitoredFolderConfig, FetchedFileEntry, LogEntry as AppLogEntry } from "@/types"; // Renamed LogEntry to avoid conflict
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

export interface FetchFtpFolderResponse {
    success: boolean;
    message: string;
    folderName: string;
    processedFiles: { name: string; status: 'simulated_save_success' | 'simulated_save_failed'; error?: string }[];
    error?: string; // General error for the folder processing (e.g., connection failed)
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
    // console.error("Validation failed:", validationResult.error.flatten()); // Already logged client side
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

export async function getAppStatusAndLogs(): Promise<{ status: 'monitoring' | 'idle' | 'error', logs: AppLogEntry[], config: AppConfig | null }> {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate small delay
    return {
        status: isMonitoringActive ? 'monitoring' : 'idle',
        logs: [...ftpOperationLogs], // Return a copy of the server logs
        config: currentAppConfig,
    };
}


async function saveLocalFile(
  rootLocalPath: string,
  targetSubFolder: string,
  fileName: string,
  content: string 
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
    await fs.writeFile(fullFilePath, content, 'utf-8');
    
    const successMsg = `File '${fileName}' saved to ${fullDirectoryPath}.`;
    // addFtpLog(successMsg, 'success'); // Logged by caller if needed based on context
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
): Promise<FetchFtpFolderResponse> {
    const client = new Client();
    client.ftp.verbose = false; 
    const processedFiles: FetchFtpFolderResponse['processedFiles'] = [];
    const logPrefix = `FTP Folder [${folderConfig.name}]:`;

    try {
        addFtpLog(`${logPrefix} Attempting to connect to ${serverDetails.host}:${serverDetails.port}`, 'info');
        await client.access({
            host: serverDetails.host,
            port: serverDetails.port,
            user: serverDetails.username,
            password: serverDetails.password,
            secure: false 
        });
        addFtpLog(`${logPrefix} Connected. Navigating to remote path: ${folderConfig.remotePath}`, 'info');
        
        await client.cd(folderConfig.remotePath);
        const ftpFiles: FileInfo[] = await client.list();
        addFtpLog(`${logPrefix} Found ${ftpFiles.length} files/folders in ${folderConfig.remotePath}.`, 'info');

        if (ftpFiles.length === 0) {
            return {
                success: true,
                folderName: folderConfig.name,
                message: `No files found in ${folderConfig.remotePath}.`,
                processedFiles: []
            };
        }

        for (const fileInfo of ftpFiles) {
            if (fileInfo.type === 1) { 
                const fileName = fileInfo.name;
                const simulatedContent = `Simulated content for REAL file: ${fileName}\nFrom FTP folder: ${folderConfig.remotePath}\nTimestamp: ${new Date().toISOString()}\nThis is a file entry based on a real FTP listing by NiMet-SADIS-Ingest. Actual content download is the next step.`;
                
                const saveResult = await saveLocalFile(serverDetails.localPath, folderConfig.name, fileName, simulatedContent);
                if (saveResult.success) {
                    processedFiles.push({ name: fileName, status: 'simulated_save_success' });
                    addFtpLog(`${logPrefix} File '${fileName}' placeholder saved successfully to local path.`, 'success');
                } else {
                    processedFiles.push({ name: fileName, status: 'simulated_save_failed', error: saveResult.message });
                    addFtpLog(`${logPrefix} Failed to save placeholder for file '${fileName}': ${saveResult.message}`, 'error');
                }
            }
        }
        const finalMessage = `${logPrefix} Listed ${ftpFiles.length} items. Processed ${processedFiles.length} files.`;
        addFtpLog(finalMessage, processedFiles.some(f => f.status === 'simulated_save_failed') ? 'warning' : 'success');
        return {
            success: true,
            folderName: folderConfig.name,
            message: finalMessage,
            processedFiles
        };

    } catch (err: any) {
        const errorMsg = `${logPrefix} Error processing FTP folder ${folderConfig.remotePath}: ${err.message}`;
        addFtpLog(errorMsg, 'error');
        return {
            success: false,
            folderName: folderConfig.name,
            message: errorMsg,
            processedFiles,
            error: err.message
        };
    } finally {
        if (client.closed === false) {
            addFtpLog(`${logPrefix} Closing FTP connection.`, 'info');
            await client.close();
        }
    }
}


// Kept for type compatibility, but saveLocalFile is primary now.
export async function saveSimulatedFile(
  rootLocalPath: string,
  targetSubFolder: string,
  fileName: string
): Promise<{ success: boolean; message: string; fullPath?: string }> {
  const simulatedContent = `Simulated content for file: ${fileName}\nSaved in folder: ${targetSubFolder}\nTimestamp: ${new Date().toISOString()}\nThis is a simulated file downloaded by NiMet-SADIS-Ingest.`;
  addFtpLog(`Saving simulated file (legacy call): ${fileName} to ${targetSubFolder}`, 'info');
  return saveLocalFile(rootLocalPath, targetSubFolder, fileName, simulatedContent);
}


    