"use server";

import type { FtpConfig } from "@/types";
import { z } from "zod";

const ftpConfigSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().int().positive("Port must be a positive integer"),
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  remotePath: z.string().min(1, "Remote path is required"),
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

  // In a real app, you would save this configuration and start the FTP monitoring service.
  // For now, we'll just return a success message and the config.

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

// Simulate fetching status and logs
export async function getAppStatusAndLogs(): Promise<{ status: 'monitoring' | 'idle' | 'error', logs: [], config: FtpConfig | null }> {
    // This is a placeholder. In a real app, this would query the actual monitoring service.
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
    return {
        status: isMonitoringActive ? 'monitoring' : 'idle',
        logs: [], // Placeholder for logs
        config: currentConfig,
    };
}
