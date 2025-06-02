
"use server";

import type { FtpConfig } from "@/types";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';

const ftpConfigSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().int().positive("Port must be a positive integer"),
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  remotePath: z.string().min(1, "Remote path is required").refine(val => val.startsWith('/'), { message: "Remote path must start with /"}),
  localPath: z.string().min(1, "Local path is required"),
  interval: z.coerce.number().int().min(1, "Interval must be at least 1 minute"),
});

export interface ActionResponse {
  success: boolean;
  message: string;
  config?: FtpConfig;
  errorDetails?: Record<string, string[]>;
}

// Simulate starting/stopping monitoring
let isMonitoringActive = false;
let currentConfig: FtpConfig | null = null;

export async function submitConfiguration(
  prevState: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  const rawFormData = Object.fromEntries(formData.entries());

  const validationResult = ftpConfigSchema.safeParse(rawFormData);

  if (!validationResult.success) {
    console.error("Validation failed:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check your inputs.",
      errorDetails: validationResult.error.flatten().fieldErrors,
    };
  }

  const newConfig = validationResult.data;
  currentConfig = newConfig;
  isMonitoringActive = true; // Simulate starting monitoring

  console.log("Configuration submitted:", newConfig);

  return {
    success: true,
    message: "Configuration applied. Monitoring started (simulated).",
    config: newConfig,
  };
}

export async function toggleMonitoring(start: boolean): Promise<ActionResponse> {
  if (start && !currentConfig) {
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
    config: currentConfig ?? undefined, // Return current config if available
  };
}

export async function getAppStatusAndLogs(): Promise<{ status: 'monitoring' | 'idle' | 'error', logs: [], config: FtpConfig | null }> {
    await new Promise(resolve => setTimeout(resolve, 200)); 
    return {
        status: isMonitoringActive ? 'monitoring' : 'idle',
        logs: [], 
        config: currentConfig,
    };
}

export async function saveSimulatedFile(
  configLocalPath: string, 
  fileName: string
): Promise<{ success: boolean; message: string; fullPath?: string }> {
  if (!configLocalPath || !fileName) {
    return { success: false, message: "Local path or filename missing for saving file." };
  }
  try {
    // Relative paths are resolved against process.cwd() by default, which is usually the project root.
    // For absolute paths, fs.mkdir and path.join will use them as is.
    const targetDirectory = path.resolve(configLocalPath); // Ensure it's an absolute path for consistency
    
    await fs.mkdir(targetDirectory, { recursive: true });
    
    const fullPath = path.join(targetDirectory, fileName);
    
    const fileContent = `Simulated content for file: ${fileName}\nTimestamp: ${new Date().toISOString()}\nThis is a simulated file downloaded by NiMet-SADIS-Ingest.`;
    await fs.writeFile(fullPath, fileContent, 'utf-8');
    
    console.log(`Simulated file saved with content: ${fullPath}`);
    return { success: true, message: `Simulated file '${fileName}' saved with content to ${targetDirectory}.`, fullPath };
  } catch (error: any) {
    console.error(`Failed to save simulated file '${fileName}' to ${configLocalPath}:`, error);
    return { 
      success: false, 
      message: `Failed to save simulated file '${fileName}' to ${configLocalPath}. Error: ${error.message}. Check server permissions and path validity.` 
    };
  }
}
