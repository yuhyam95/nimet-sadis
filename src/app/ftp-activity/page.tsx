
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { AppConfig, LogEntry, AppStatus, MonitoredFolderConfig, FetchedFileEntry } from "@/types";
import { getAppStatusAndLogs, saveSimulatedFile } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Rss, Activity, Loader2 as InitialLoader } from "lucide-react";

const MinimalStatusDisplay: React.FC<{ status: AppStatus; isMonitoring: boolean; message?: string }> = ({ status, isMonitoring, message }) => {
  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let badgeText = "Idle";
  let IconComponent: React.ElementType = Activity;

  if (status === 'configuring') {
    badgeVariant = "outline";
    badgeText = "Initializing...";
    IconComponent = InitialLoader;
  } else if (isMonitoring) {
    switch (status) {
      case 'monitoring': badgeVariant = "default"; badgeText = "Monitoring"; IconComponent = Rss; break;
      case 'connecting': badgeVariant = "outline"; badgeText = "Connecting..."; IconComponent = Activity; break;
      case 'transferring': badgeVariant = "outline"; badgeText = "Transferring..."; IconComponent = Activity; break;
      case 'success': badgeVariant = "default"; badgeText = "Transfer Success"; IconComponent = CheckCircle2; break; // Generic success
      case 'error': badgeVariant = "destructive"; badgeText = "Error"; IconComponent = AlertCircle; break;
      default: badgeText = "Standby"; IconComponent = Rss; break;
    }
  } else if (status === 'error') {
    badgeVariant = "destructive"; badgeText = "Error"; IconComponent = AlertCircle;
  } else {
    badgeText = "Idle";
    IconComponent = Activity;
  }

  return (
    <Card className="w-full shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-xl">
          <IconComponent className={`mr-2 h-5 w-5 ${IconComponent === InitialLoader ? 'animate-spin' : (isMonitoring && status !== 'error' && status !== 'configuring' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-primary')}`} />
          Application Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Badge variant={badgeVariant} className="text-sm py-1 px-3">{badgeText}</Badge>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
};


export default function FtpActivityPage() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [currentStatus, setCurrentStatus] = useState<AppStatus>("configuring");
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [fetchedFiles, setFetchedFiles] = useState<FetchedFileEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing application status...");

  const addFetchedFileEntry = useCallback((folderName: string, fileName: string) => {
    setFetchedFiles((prevFiles) => {
      const newEntry: FetchedFileEntry = { folderName, fileName, timestamp: new Date() };
      return [newEntry, ...prevFiles].slice(0, 50); // Keep last 50 files
    });
  }, []);

  useEffect(() => {
    async function fetchInitialStatusAndConfig() {
      setCurrentStatus("configuring");
      setStatusMessage("Initializing application state...");
      try {
        const { status: serverStatus, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setAppConfig(serverConfig);
          setIsMonitoring(serverStatus === 'monitoring');
          setCurrentStatus(serverStatus === 'monitoring' ? 'monitoring' : 'idle');
          setStatusMessage(serverStatus === 'monitoring' ? `Monitoring active for ${serverConfig.folders.length} folder(s).` : "Idle. Start monitoring from Configuration page.");
        } else {
          setAppConfig(null);
          setIsMonitoring(false);
          setCurrentStatus('idle');
          setStatusMessage("No active configuration. Please set up in Configuration page.");
        }
      } catch (error) {
        console.error("Failed to fetch initial app status for FTP Activity Page:", error);
        setCurrentStatus("error");
        setIsMonitoring(false);
        setAppConfig(null);
        setStatusMessage("Error fetching status. Please check server logs or console.");
      }
    }
    fetchInitialStatusAndConfig();
  }, []);

  useEffect(() => {
    const activeIntervals: NodeJS.Timeout[] = [];
    const activeTimeouts: NodeJS.Timeout[] = []; // To clear inner timeouts as well

    if (isMonitoring && appConfig && appConfig.folders && appConfig.folders.length > 0) {
      setCurrentStatus('connecting'); 
      setStatusMessage(`Initializing monitoring for ${appConfig.folders.length} folder(s)...`);

      const initialConnectionTimeout = setTimeout(() => {
        if (!isMonitoring || !appConfig) return; 

        setCurrentStatus('monitoring');
        setStatusMessage(`Monitoring ${appConfig.folders.length} folder(s) on ${appConfig.server.host}.`);

        appConfig.folders.forEach((folder: MonitoredFolderConfig) => {
          const intervalId = setInterval(async () => {
            if (!isMonitoring || !appConfig) { 
              clearInterval(intervalId);
              return;
            }

            const outcome = Math.random();
            
            if (outcome < 0.1) { 
              setStatusMessage(`Error checking ${folder.name} on ${appConfig.server.host}.`);
            } else if (outcome < 0.6) { 
              // To avoid too many logs, only update status if it's not already generic monitoring
              // and not currently in a transfer/success/error state from another folder.
              if (currentStatus === 'monitoring') { // Check against the REACT state, not a stale closure value
                 setStatusMessage(`Last check for ${folder.name}: No new files. Monitoring...`);
              }
            } else { 
              const fileName = `sim_${folder.name.replace(/\s+/g, '_')}_${Date.now().toString().slice(-5)}_${Math.random().toString(36).substring(2, 7)}.dat`;
              setCurrentStatus('transferring'); 
              setStatusMessage(`Transferring '${fileName}' from ${folder.name}...`);

              const transferTimeoutId = setTimeout(async () => {
                if (!isMonitoring || !appConfig) return; 

                const saveResult = await saveSimulatedFile(appConfig.server.localPath, folder.name, fileName);
                if (saveResult.success) {
                  addFetchedFileEntry(folder.name, fileName);
                  setCurrentStatus('success'); 
                  setStatusMessage(`Successfully transferred '${fileName}' from ${folder.name}.`);
                } else {
                  console.warn(`File '${fileName}' from ${folder.name} transferred (simulated) but failed to save locally: ${saveResult.message}`);
                  setCurrentStatus('error'); 
                  setStatusMessage(`Failed to save '${fileName}' from ${folder.name}. ${saveResult.message}`);
                }
                
                const successToMonitorTimeoutId = setTimeout(() => {
                  if (isMonitoring && appConfig) { // Check again before reverting
                      setCurrentStatus('monitoring'); 
                      setStatusMessage(`Monitoring ${appConfig.folders.length} folder(s) on ${appConfig.server.host}.`);
                  }
                }, 2000);
                activeTimeouts.push(successToMonitorTimeoutId);

              }, 1500); 
              activeTimeouts.push(transferTimeoutId);
            }
          }, (folder.interval || 5) * 1000 * 0.7); // Shortened interval for testing
          activeIntervals.push(intervalId);
        });
      }, 1500); 

      activeTimeouts.push(initialConnectionTimeout);

    } else if (!isMonitoring) {
      setCurrentStatus('idle');
      setStatusMessage(appConfig ? "Monitoring paused." : "No active configuration. Please set up in Configuration page.");
    } else if (isMonitoring && (!appConfig || !appConfig.folders || appConfig.folders.length === 0)) {
      setCurrentStatus('idle');
      setStatusMessage("Monitoring active, but no folders configured to watch.");
    }

    return () => {
      activeIntervals.forEach(clearInterval);
      activeTimeouts.forEach(clearTimeout); // Clear all timeouts
    };
  }, [isMonitoring, appConfig, addFetchedFileEntry]); // Removed currentStatus


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-primary tracking-tight">
            FTP Activity & Fetched Files
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Monitor live FTP transfers from configured folders and view retrieved files.
            </p>
        </div>
        <div className="md:hidden">
            <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <MinimalStatusDisplay status={currentStatus} isMonitoring={isMonitoring} message={statusMessage} />

        <FetchedFilesList files={fetchedFiles} />

      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. FTP Activity.</p>
      </footer>
    </div>
  );
}

