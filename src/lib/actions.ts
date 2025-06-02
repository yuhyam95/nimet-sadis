
"use server";

import type { AppConfig, FtpServerDetails, MonitoredFolderConfig, FetchedFileEntry } from "@/types";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { Client, FileInfo } from 'basic-ftp';

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
    console.error("Validation failed:", validationResult.error.flatten());
    return {
      success: false,
      message: "Validation failed. Please check your inputs.",
      errorDetails: validationResult.error.flatten().fieldErrors,
    };
  }

  const newConfig = validationResult.data;
  currentAppConfig = newConfig;
  isMonitoringActive = true; 

  console.log("Configuration submitted:", newConfig);

  try {
    await fs.mkdir(path.resolve(newConfig.server.localPath), { recursive: true });
  } catch (error: any) {
    console.warn(`Could not create root local path ${newConfig.server.localPath}: ${error.message}`);
  }

  return {
    success: true,
    message: "Configuration applied. Monitoring can be started from FTP Activity page if not already active.",
    config: newConfig,
  };
}

export async function toggleMonitoring(start: boolean): Promise<ActionResponse> {
  if (start && !currentAppConfig) {
    isMonitoringActive = false;
    return {
      success: false,
      message: "Cannot start monitoring. Configuration is missing.",
    };
  }

  isMonitoringActive = start;
  const statusMessage = start ? "Monitoring enabled. Activity will be initiated from the FTP Activity page." : "Monitoring disabled.";
  
  return {
    success: true,
    message: statusMessage,
    config: currentAppConfig ?? undefined,
  };
}

export async function getAppStatusAndLogs(): Promise<{ status: 'monitoring' | 'idle' | 'error', logs: [], config: AppConfig | null }> {
    await new Promise(resolve => setTimeout(resolve, 200)); 
    return {
        status: isMonitoringActive ? 'monitoring' : 'idle',
        logs: [], 
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
    return { success: false, message: "Root local path, target subfolder, or filename missing for saving file." };
  }
  try {
    const resolvedRootPath = path.resolve(rootLocalPath);
    const fullDirectoryPath = path.join(resolvedRootPath, targetSubFolder);
    
    await fs.mkdir(fullDirectoryPath, { recursive: true });
    
    const fullFilePath = path.join(fullDirectoryPath, fileName);
    await fs.writeFile(fullFilePath, content, 'utf-8');
    
    console.log(`File saved: ${fullFilePath}`);
    return { success: true, message: `File '${fileName}' saved to ${fullDirectoryPath}.`, fullPath: fullFilePath };
  } catch (error: any) {
    console.error(`Failed to save file '${fileName}' to '${targetSubFolder}' in '${rootLocalPath}':`, error);
    return { 
      success: false, 
      message: `Failed to save file '${fileName}' to subfolder '${targetSubFolder}'. Error: ${error.message}. Check server permissions and path validity.` 
    };
  }
}


export async function fetchAndProcessFtpFolder(
    serverDetails: FtpServerDetails,
    folderConfig: MonitoredFolderConfig
): Promise<FetchFtpFolderResponse> {
    const client = new Client();
    client.ftp.verbose = false; // Set to true for detailed FTP logs in server console
    const processedFiles: FetchFtpFolderResponse['processedFiles'] = [];

    try {
        console.log(`Attempting to connect to FTP: ${serverDetails.host}:${serverDetails.port} for folder ${folderConfig.name}`);
        await client.access({
            host: serverDetails.host,
            port: serverDetails.port,
            user: serverDetails.username,
            password: serverDetails.password,
            secure: false // Adjust if using FTPS/TLS
        });
        console.log(`Connected to FTP for folder ${folderConfig.name}. Navigating to ${folderConfig.remotePath}`);
        
        await client.cd(folderConfig.remotePath);
        const ftpFiles: FileInfo[] = await client.list();
        console.log(`Found ${ftpFiles.length} files/folders in ${folderConfig.remotePath} for folder ${folderConfig.name}`);

        if (ftpFiles.length === 0) {
            return {
                success: true,
                folderName: folderConfig.name,
                message: `No files found in ${folderConfig.remotePath} for folder ${folderConfig.name}.`,
                processedFiles: []
            };
        }

        for (const fileInfo of ftpFiles) {
            if (fileInfo.type === 1) { // Type 1 is usually a file. Type 2 is a directory.
                const fileName = fileInfo.name;
                // For now, we save with simulated content using the real filename
                const simulatedContent = `Simulated content for REAL file: ${fileName}\nFrom FTP folder: ${folderConfig.remotePath}\nTimestamp: ${new Date().toISOString()}\nThis is a file entry based on a real FTP listing by NiMet-SADIS-Ingest. Actual content download is the next step.`;
                
                const saveResult = await saveLocalFile(serverDetails.localPath, folderConfig.name, fileName, simulatedContent);
                if (saveResult.success) {
                    processedFiles.push({ name: fileName, status: 'simulated_save_success' });
                } else {
                    processedFiles.push({ name: fileName, status: 'simulated_save_failed', error: saveResult.message });
                }
            }
        }

        return {
            success: true,
            folderName: folderConfig.name,
            message: `Successfully listed ${ftpFiles.length} items in ${folderConfig.remotePath}. Processed ${processedFiles.length} files for folder ${folderConfig.name}.`,
            processedFiles
        };

    } catch (err: any) {
        console.error(`FTP Error for folder ${folderConfig.name} (${folderConfig.remotePath}):`, err.message);
        return {
            success: false,
            folderName: folderConfig.name,
            message: `Error processing FTP folder ${folderConfig.name} (${folderConfig.remotePath}): ${err.message}`,
            processedFiles,
            error: err.message
        };
    } finally {
        if (client.closed === false) {
            console.log(`Closing FTP connection for folder ${folderConfig.name}`);
            await client.close();
        }
    }
}

// Old function, kept for reference or if direct simulated saving is ever needed.
// For now, saveLocalFile is the generic local file writer.
export async function saveSimulatedFile(
  rootLocalPath: string,
  targetSubFolder: string,
  fileName: string
): Promise<{ success: boolean; message: string; fullPath?: string }> {
  const simulatedContent = `Simulated content for file: ${fileName}\nSaved in folder: ${targetSubFolder}\nTimestamp: ${new Date().toISOString()}\nThis is a simulated file downloaded by NiMet-SADIS-Ingest.`;
  return saveLocalFile(rootLocalPath, targetSubFolder, fileName, simulatedContent);
}
