
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { AppConfig, LogEntry, AppStatus, MonitoredFolderConfig, FetchedFileEntry, FetchFtpFolderResponse as ServerFetchResponse } from "@/types";
import { getAppStatusAndLogs, fetchAndProcessFtpFolder } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Rss, Activity, Loader2 as InitialLoader, AlertTriangle } from "lucide-react";

// Renamed FetchFtpFolderResponse to avoid conflict with the server action's return type name
type ClientFetchFtpFolderResponse = ServerFetchResponse;


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
      case 'monitoring': badgeVariant = "default"; badgeText = "Monitoring Active"; IconComponent = Rss; break;
      case 'connecting': badgeVariant = "outline"; badgeText = "Connecting to FTP..."; IconComponent = Activity; break;
      case 'transferring': badgeVariant = "outline"; badgeText = "Processing Folders..."; IconComponent = Activity; break;
      case 'success': badgeVariant = "default"; badgeText = "Folder Processed"; IconComponent = CheckCircle2; break;
      case 'error': badgeVariant = "destructive"; badgeText = "Folder Error"; IconComponent = AlertCircle; break;
      default: badgeText = "Standby"; IconComponent = Rss; break; 
    }
  } else if (status === 'error' && !isMonitoring) { 
    badgeVariant = "destructive"; badgeText = "System Error"; IconComponent = AlertTriangle;
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
  const [currentOverallStatus, setCurrentOverallStatus] = useState<AppStatus>("configuring");
  const [isGloballyMonitoring, setIsGloballyMonitoring] = useState<boolean>(false);
  const [fetchedFiles, setFetchedFiles] = useState<FetchedFileEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing application status...");

  const addFetchedFileEntry = useCallback((folderName: string, fileName: string, timestamp: Date = new Date()) => {
    setFetchedFiles((prevFiles) => {
      const newEntry: FetchedFileEntry = { folderName, fileName, timestamp };
      return [newEntry, ...prevFiles].slice(0, 100); 
    });
  }, []);

  useEffect(() => {
    async function fetchInitialStatusAndConfig() {
      setCurrentOverallStatus("configuring");
      setStatusMessage("Initializing application state...");
      try {
        const { status: serverOverallStatus, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setAppConfig(serverConfig);
          setIsGloballyMonitoring(serverOverallStatus === 'monitoring');
          setCurrentOverallStatus(serverOverallStatus === 'monitoring' ? 'monitoring' : 'idle');
          setStatusMessage(serverOverallStatus === 'monitoring' ? `Monitoring active for ${serverConfig.folders.length} folder(s). Ready to poll.` : "Idle. Monitoring is not active. Check Configuration.");
        } else {
          setAppConfig(null);
          setIsGloballyMonitoring(false);
          setCurrentOverallStatus('idle');
          setStatusMessage("No active configuration. Please set up in Configuration page.");
        }
      } catch (error) {
        console.error("Failed to fetch initial app status for FTP Activity Page:", error);
        setCurrentOverallStatus("error");
        setIsGloballyMonitoring(false);
        setAppConfig(null);
        setStatusMessage("Error fetching status. Please check server logs or console.");
      }
    }
    fetchInitialStatusAndConfig();
  }, []);

  useEffect(() => {
    const activeIntervals: NodeJS.Timeout[] = [];
  
    if (isGloballyMonitoring && appConfig && appConfig.server && appConfig.folders && appConfig.folders.length > 0) {
      setStatusMessage(`Initializing polling for ${appConfig.folders.length} folder(s) on ${appConfig.server.host}.`);
      setCurrentOverallStatus('connecting'); 

      appConfig.folders.forEach((folder: MonitoredFolderConfig) => {
        const pollFolder = async () => {
          if (!isGloballyMonitoring || !appConfig || !appConfig.server) return;

          setCurrentOverallStatus('transferring'); 
          setStatusMessage(`Checking folder '${folder.name}' on ${appConfig.server.host}...`);
          
          try {
            // Call the new server action
            const result: ClientFetchFtpFolderResponse = await fetchAndProcessFtpFolder(appConfig.server, folder);
            
            if (result.success) {
              result.processedFiles.forEach(file => {
                if (file.status === 'simulated_save_success') { 
                  addFetchedFileEntry(folder.name, file.name);
                }
              });
              setStatusMessage(`Folder '${folder.name}': ${result.message}`);
              setCurrentOverallStatus('success'); 
            } else {
              setStatusMessage(`Error processing folder '${folder.name}': ${result.message}`);
              setCurrentOverallStatus('error'); 
            }
          } catch (e: any) {
            setStatusMessage(`Critical error polling folder '${folder.name}': ${e.message}`);
            setCurrentOverallStatus('error'); 
          }
          
          setTimeout(() => {
            if (isGloballyMonitoring && appConfig) {
                 setCurrentOverallStatus(prev => prev === 'error' ? 'error' : 'monitoring');
                 setStatusMessage(`Monitoring active for ${appConfig.folders.length} folder(s). Last checked: ${folder.name}.`);
            }
          }, 3000);
        };

        pollFolder(); 
        const intervalId = setInterval(pollFolder, (folder.interval || 5) * 60 * 1000); 
        activeIntervals.push(intervalId);
      });

    } else if (!isGloballyMonitoring) {
      setCurrentOverallStatus('idle');
      setStatusMessage(appConfig ? "Monitoring paused. Enable via Configuration page." : "No active configuration. Please set up in Configuration page.");
    } else if (isGloballyMonitoring && (!appConfig || !appConfig.folders || appConfig.folders.length === 0)) {
      setCurrentOverallStatus('idle');
      setStatusMessage("Monitoring active, but no folders configured to watch.");
    }
  
    return () => {
      activeIntervals.forEach(clearInterval);
    };
  }, [isGloballyMonitoring, appConfig, addFetchedFileEntry]);


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
        <MinimalStatusDisplay status={currentOverallStatus} isMonitoring={isGloballyMonitoring} message={statusMessage} />
        <FetchedFilesList files={fetchedFiles} />
      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. FTP Activity.</p>
      </footer>
    </div>
  );
}
