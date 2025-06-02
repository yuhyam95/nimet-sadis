
"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { AppConfig, LogEntry, AppStatus, MonitoredFolderConfig, FetchedFileEntry } from "@/types";
import { getAppStatusAndLogs, toggleMonitoring, saveSimulatedFile } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Rss, Activity, Loader2 as InitialLoader, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const [isStopping, setIsStopping] = useState(false);
  const [_isPendingToggle, startToggleTransition] = useTransition();

  const addFetchedFileEntry = useCallback((folderName: string, fileName: string) => {
    setFetchedFiles((prevFiles) => {
      const newEntry = { folderName, fileName, timestamp: new Date() };
      // Avoid duplicates if needed, though unlikely with unique timestamps/filenames
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
          setStatusMessage(serverStatus === 'monitoring' ? "Monitoring active for configured folders." : "Idle. Start monitoring from Configuration page.");
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

    if (isMonitoring && appConfig && appConfig.folders && appConfig.folders.length > 0) {
      setCurrentStatus('connecting'); // Overall status
      setStatusMessage(`Initializing monitoring for ${appConfig.folders.length} folder(s)...`);

      // Simulate initial connection phase for all folders
      const initialConnectionTimeout = setTimeout(() => {
        if (!isMonitoring || !appConfig) return; // Guard against state changes

        setCurrentStatus('monitoring');
        setStatusMessage(`Monitoring ${appConfig.folders.length} folder(s) on ${appConfig.server.host}.`);

        appConfig.folders.forEach((folder: MonitoredFolderConfig) => {
          const intervalId = setInterval(async () => {
            if (!isMonitoring || !appConfig) { // Check again inside interval
              clearInterval(intervalId);
              return;
            }

            const outcome = Math.random();
            setCurrentStatus('transferring'); // Indicates some activity is happening

            if (outcome < 0.1) { // Simulate an error for this folder check
              setStatusMessage(`Error checking ${folder.name} on ${appConfig.server.host}.`);
              // Optionally, you could set overall status to 'error' or handle per-folder errors
            } else if (outcome < 0.6) { // Simulate no new files for this folder
              setStatusMessage(`Last check for ${folder.name}: No new files. Monitoring...`);
            } else { // Simulate file found and transfer
              const fileName = `sim_${folder.name.replace(/\s+/g, '_')}_${Date.now().toString().slice(-5)}_${Math.random().toString(36).substring(2, 7)}.dat`;
              setStatusMessage(`Transferring '${fileName}' from ${folder.name}...`);

              // Simulate transfer time
              const transferTimeoutId = setTimeout(async () => {
                if (!isMonitoring || !appConfig) return; // Guard

                const saveResult = await saveSimulatedFile(appConfig.server.localPath, folder.name, fileName);
                if (saveResult.success) {
                  addFetchedFileEntry(folder.name, fileName);
                  setCurrentStatus('success'); // Indicates last operation was a success
                  setStatusMessage(`Successfully transferred '${fileName}' from ${folder.name}.`);
                } else {
                  console.warn(`File '${fileName}' from ${folder.name} transferred (simulated) but failed to save locally: ${saveResult.message}`);
                  setCurrentStatus('error'); // Reflect save error
                  setStatusMessage(`Failed to save '${fileName}' from ${folder.name}. ${saveResult.message}`);
                }
                
                // Short delay before reverting status message to general monitoring
                const successToMonitorTimeoutId = setTimeout(() => {
                  if (isMonitoring && appConfig) {
                      setCurrentStatus('monitoring'); // Back to overall monitoring
                      setStatusMessage(`Monitoring ${appConfig.folders.length} folder(s) on ${appConfig.server.host}.`);
                  }
                }, 2000);
                activeIntervals.push(successToMonitorTimeoutId);

              }, 1500); // Shorter simulated transfer time
              activeIntervals.push(transferTimeoutId);
            }
          }, (folder.interval || 5) * 1000 * 0.7); // Use individual folder interval, slightly faster for demo
          activeIntervals.push(intervalId);
        });
      }, 1500); // Time for "connecting" phase

      activeIntervals.push(initialConnectionTimeout);

    } else if (!isMonitoring) {
      setCurrentStatus('idle');
      setStatusMessage(appConfig ? "Monitoring paused." : "No active configuration.");
    } else if (isMonitoring && (!appConfig || !appConfig.folders || appConfig.folders.length === 0)) {
      setCurrentStatus('idle');
      setStatusMessage("Monitoring active, but no folders configured to watch.");
    }

    return () => {
      activeIntervals.forEach(clearInterval);
    };
  }, [isMonitoring, appConfig, addFetchedFileEntry]);


  const handleStopMonitoring = () => {
    if (!appConfig) {
      console.warn("Cannot stop monitoring, no configuration active.");
      return;
    }
    setIsStopping(true);
    startToggleTransition(async () => {
      try {
        const response = await toggleMonitoring(false);
        if (response.success) {
          setIsMonitoring(false);
          // currentStatus and statusMessage will be updated by the main useEffect
        } else {
          setStatusMessage(`Failed to stop monitoring: ${response.message}`);
          console.error(`Failed to stop monitoring: ${response.message}`);
        }
      } catch (error) {
        setStatusMessage("An unexpected error occurred while stopping monitoring.");
        console.error("Error when trying to stop monitoring:", error);
      } finally {
        setIsStopping(false);
      }
    });
  };

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

        {isMonitoring && appConfig && (
          <Button
            onClick={handleStopMonitoring}
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={isStopping || _isPendingToggle}
          >
            {isStopping || _isPendingToggle ? <InitialLoader className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
            Stop Monitoring
          </Button>
        )}

        <FetchedFilesList files={fetchedFiles} />

      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. FTP Activity.</p>
      </footer>
    </div>
  );
}
