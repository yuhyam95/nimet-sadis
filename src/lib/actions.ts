
"use server";

import type { AppConfig, FtpServerDetails, MonitoredFolderConfig } from "@/types";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';

const ftpServerDetailsSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().int().positive("Port must be a positive integer"),
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  localPath: z.string().min(1, "Root local path is required"), // Cannot require starting with / if we want project-relative paths
});

const monitoredFolderConfigSchema = z.object({
  id: z.string().min(1), // Typically a UUID generated on the client
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
  config?: AppConfig; // Updated to AppConfig
  errorDetails?: Record<string, any>; // Can be nested for field arrays
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

  // Create the root localPath directory if it doesn't exist
  try {
    await fs.mkdir(path.resolve(newConfig.server.localPath), { recursive: true });
  } catch (error: any) {
     // Log the error, but don't fail the whole submission for this
     // The saveSimulatedFile action will handle per-folder errors
    console.warn(`Could not create root local path ${newConfig.server.localPath}: ${error.message}`);
  }


  return {
    success: true,
    message: "Configuration applied. Monitoring started (simulated).",
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
  const statusMessage = start ? "Monitoring started (simulated)." : "Monitoring stopped (simulated).";
  
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

export async function saveSimulatedFile(
  rootLocalPath: string,
  targetSubFolder: string, // e.g., MonitoredFolderConfig.name
  fileName: string
): Promise<{ success: boolean; message: string; fullPath?: string }> {
  if (!rootLocalPath || !targetSubFolder || !fileName) {
    return { success: false, message: "Root local path, target subfolder, or filename missing for saving file." };
  }
  try {
    const resolvedRootPath = path.resolve(rootLocalPath); // Ensure root is absolute
    const fullDirectoryPath = path.join(resolvedRootPath, targetSubFolder);
    
    await fs.mkdir(fullDirectoryPath, { recursive: true });
    
    const fullFilePath = path.join(fullDirectoryPath, fileName);
    
    const fileContent = `Simulated content for file: ${fileName}\nSaved in folder: ${targetSubFolder}\nTimestamp: ${new Date().toISOString()}\nThis is a simulated file downloaded by NiMet-SADIS-Ingest.`;
    await fs.writeFile(fullFilePath, fileContent, 'utf-8');
    
    console.log(`Simulated file saved: ${fullFilePath}`);
    return { success: true, message: `Simulated file '${fileName}' saved to ${fullDirectoryPath}.`, fullPath: fullFilePath };
  } catch (error: any) {
    console.error(`Failed to save simulated file '${fileName}' to '${targetSubFolder}' in '${rootLocalPath}':`, error);
    return { 
      success: false, 
      message: `Failed to save simulated file '${fileName}' to subfolder '${targetSubFolder}'. Error: ${error.message}. Check server permissions and path validity.` 
    };
  }
}
