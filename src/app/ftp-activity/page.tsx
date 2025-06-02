
"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { FtpConfig, LogEntry, AppStatus } from "@/types";
import { getAppStatusAndLogs, toggleMonitoring, saveSimulatedFile } from "@/lib/actions"; 
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Rss, Activity, Loader2 as InitialLoader, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Minimal StatusDisplay for this page
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
      case 'success': badgeVariant = "default"; badgeText = "File Transfer Success"; IconComponent = CheckCircle2; break;
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
  const [config, setConfig] = useState<FtpConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AppStatus>("configuring");
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [fetchedFiles, setFetchedFiles] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing application status...");
  
  const [isStopping, setIsStopping] = useState(false);
  const [_isPendingToggle, startToggleTransition] = useTransition();


  const addLogEntry = useCallback((newLog: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prevLogs) => [
      { ...newLog, id: crypto.randomUUID(), timestamp: new Date() },
      ...prevLogs,
    ].slice(0, 20)); 
  }, []);

  const addFetchedFile = useCallback((fileName: string) => {
    setFetchedFiles((prevFiles) => {
      if (!prevFiles.includes(fileName)) {
        return [fileName, ...prevFiles];
      }
      return prevFiles;
    });
  }, []);

  useEffect(() => {
    async function fetchInitialStatusAndConfig() {
      setCurrentStatus("configuring");
      setStatusMessage("Initializing application state...");
      try {
        const { status: serverStatus, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setConfig(serverConfig);
          setIsMonitoring(serverStatus === 'monitoring');
          setCurrentStatus(serverStatus === 'monitoring' ? 'monitoring' : 'idle'); 
          setStatusMessage(serverStatus === 'monitoring' ? "Monitoring active." : "Idle. Start monitoring from Configuration page.");
        } else {
          setConfig(null);
          setIsMonitoring(false);
          setCurrentStatus('idle');
          setStatusMessage("No active configuration. Please set up in Configuration page.");
        }
      } catch (error) {
        console.error("Failed to fetch initial app status for FTP Activity Page:", error);
        setCurrentStatus("error");
        setIsMonitoring(false);
        setConfig(null);
        setStatusMessage("Error fetching status. Please check server logs or console.");
      }
    }
    fetchInitialStatusAndConfig();
  }, []); // Removed addLogEntry from here as it's no longer directly displayed

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    let connectTimeoutId: NodeJS.Timeout | undefined;
    let transferTimeoutId: NodeJS.Timeout | undefined;
    let successToMonitorTimeoutId: NodeJS.Timeout | undefined;

    const isCurrentlyProcessingSimulation = ['connecting', 'monitoring', 'transferring', 'success'].includes(currentStatus);

    if (isMonitoring && config) {
      if ((currentStatus === 'idle' || currentStatus === 'configuring') && !isCurrentlyProcessingSimulation) {
        setCurrentStatus('connecting');
        setStatusMessage(config.host ? `Connecting to ${config.host}...` : 'Preparing to connect...');
      }

      if (currentStatus === 'connecting') {
        connectTimeoutId = setTimeout(() => {
          if (isMonitoring && config) { 
            setCurrentStatus('monitoring');
            setStatusMessage(`Monitoring ${config.remotePath} on ${config.host}.`);
          }
        }, 1500); 
      }

      if (currentStatus === 'monitoring') {
        intervalId = setInterval(async () => { 
          const currentConfigInInterval = config; 
          if (!currentConfigInInterval || !isMonitoring) { 
            if(intervalId) clearInterval(intervalId);
            if (!currentConfigInInterval) {
                setCurrentStatus('error');
                setStatusMessage("Configuration lost during monitoring.");
            }
            return;
          }

          const outcome = Math.random();

          if (outcome < 0.1) { 
            setCurrentStatus('error');
            setStatusMessage(`Error checking ${currentConfigInInterval.host}.`);
          } else if (outcome < 0.6) { 
            setStatusMessage(`Last check: No new files. Monitoring ${currentConfigInInterval.remotePath}.`);
          } else { 
            setCurrentStatus('transferring');
            const fileName = `sim_file_${Date.now().toString().slice(-5)}_${Math.random().toString(36).substring(2, 7)}.dat`;
            setStatusMessage(`Transferring '${fileName}'...`);

            transferTimeoutId = setTimeout(async () => { 
               if (isMonitoring && config) { 
                const saveResult = await saveSimulatedFile(config.localPath, fileName);
                if (saveResult.success) {
                  // Successfully saved.
                } else {
                  console.warn(`File '${fileName}' transferred (simulated) but failed to save locally: ${saveResult.message}`);
                }
                
                addFetchedFile(fileName);
                setCurrentStatus('success');
                setStatusMessage(`Successfully transferred '${fileName}'.`);
                
                successToMonitorTimeoutId = setTimeout(() => {
                  if (isMonitoring && config) { 
                      setCurrentStatus('monitoring');
                      setStatusMessage(`Monitoring ${config.remotePath} on ${config.host}.`);
                  }
                }, 2000); 
              }
            }, 2500); 
          }
        }, (config.interval || 5) * 1000 * 0.5 ); 
      }
    } else if (!isMonitoring && isCurrentlyProcessingSimulation) {
        setCurrentStatus('idle');
        setStatusMessage(config ? "Monitoring paused." : "No active configuration. Please set up in Configuration page.");
    } else if (!isMonitoring && !config && currentStatus !== 'idle' && currentStatus !== 'error' && currentStatus !== 'configuring') {
        setCurrentStatus('idle');
        setStatusMessage("No active configuration. Please set up in Configuration page.");
    }


    return () => {
      if (intervalId) clearInterval(intervalId);
      if (connectTimeoutId) clearTimeout(connectTimeoutId);
      if (transferTimeoutId) clearTimeout(transferTimeoutId);
      if (successToMonitorTimeoutId) clearTimeout(successToMonitorTimeoutId);
    };
  }, [isMonitoring, config, addFetchedFile, currentStatus, setStatusMessage]);


  const handleStopMonitoring = () => {
    if (!config) {
      console.warn("Cannot stop monitoring, no configuration active.");
      return;
    }
    setIsStopping(true);
    startToggleTransition(async () => {
      try {
        const response = await toggleMonitoring(false); 
        if (response.success) {
          setIsMonitoring(false);
          setCurrentStatus('idle');
          setStatusMessage("Monitoring stopped by user.");
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
            Monitor live FTP transfers and view a list of successfully retrieved files.
            </p>
        </div>
        <div className="md:hidden">
            <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <MinimalStatusDisplay status={currentStatus} isMonitoring={isMonitoring} message={statusMessage} />

        {isMonitoring && config && (
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
