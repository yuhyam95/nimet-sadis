
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { AppConfig, LogEntry, AppStatus, MonitoredFolderConfig, FetchFtpFolderResponse as ServerFetchResponse, LocalDirectoryListing, LocalDirectoryResponse } from "@/types";
import { getAppStatusAndLogs, fetchAndProcessFtpFolder, getLocalDirectoryListing } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Rss, Activity, Loader2 as InitialLoader, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [localFilesListing, setLocalFilesListing] = useState<LocalDirectoryListing | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing application status...");
  const [isLoadingLocalFiles, setIsLoadingLocalFiles] = useState(false);

  const fetchLocalFiles = useCallback(async () => {
    if (!appConfig || !appConfig.server.localPath) {
      setLocalFilesListing({}); // Set to empty if no path
      return;
    }
    setIsLoadingLocalFiles(true);
    try {
      const response: LocalDirectoryResponse = await getLocalDirectoryListing();
      if (response.success && response.listing) {
        setLocalFilesListing(response.listing);
      } else {
        setStatusMessage(response.message || response.error || "Could not load local files.");
        setLocalFilesListing({}); // Set to empty on error
      }
    } catch (error) {
      setStatusMessage("Error fetching local directory listing.");
      setLocalFilesListing({});
    } finally {
      setIsLoadingLocalFiles(false);
    }
  }, [appConfig]);

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
          await fetchLocalFiles(); // Fetch local files after config is loaded
        } else {
          setAppConfig(null);
          setIsGloballyMonitoring(false);
          setCurrentOverallStatus('idle');
          setLocalFilesListing({});
          setStatusMessage("No active configuration. Please set up in Configuration page.");
        }
      } catch (error) {
        console.error("Failed to fetch initial app status for FTP Activity Page:", error);
        setCurrentOverallStatus("error");
        setIsGloballyMonitoring(false);
        setAppConfig(null);
        setLocalFilesListing({});
        setStatusMessage("Error fetching status. Please check server logs or console.");
      }
    }
    fetchInitialStatusAndConfig();
  }, [fetchLocalFiles]); // Added fetchLocalFiles to dependency

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
            const result: ClientFetchFtpFolderResponse = await fetchAndProcessFtpFolder(appConfig.server, folder);
            
            if (result.success) {
              setStatusMessage(`Folder '${folder.name}': ${result.message}`);
              setCurrentOverallStatus('success'); 
              if (result.processedFiles.some(f => f.status === 'save_success')) {
                await fetchLocalFiles(); // Refresh local files list if any file was saved
              }
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
                 setCurrentOverallStatus(prev => prev === 'error' ? 'error' : 'monitoring'); // Revert to monitoring or stay error
                 setStatusMessage(`Monitoring active for ${appConfig.folders.length} folder(s). Last checked: ${folder.name}.`);
            }
          }, 3000); // Brief pause to show success/error message before reverting to 'monitoring'
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
  }, [isGloballyMonitoring, appConfig, fetchLocalFiles]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-primary tracking-tight">
            FTP Activity & Local Files
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Monitor FTP transfers and view files stored locally from configured folders.
            </p>
        </div>
        <div className="flex items-center gap-2">
             <Button onClick={fetchLocalFiles} variant="outline" size="sm" disabled={isLoadingLocalFiles || !appConfig}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingLocalFiles ? 'animate-spin' : ''}`} />
                Refresh Local Files
            </Button>
            <div className="md:hidden">
                <SidebarTrigger />
            </div>
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <MinimalStatusDisplay status={currentOverallStatus} isMonitoring={isGloballyMonitoring} message={statusMessage} />
        <FetchedFilesList directoryListing={localFilesListing} isLoading={isLoadingLocalFiles} />
      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. FTP Activity.</p>
      </footer>
    </div>
  );
}
