
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
      addLogEntry({ message: "Fetching initial app status and configuration...", type: 'info' });
      try {
        const { status: serverStatus, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setConfig(serverConfig);
          setIsMonitoring(serverStatus === 'monitoring');
          setCurrentStatus(serverStatus === 'monitoring' ? 'monitoring' : 'idle'); 
          setStatusMessage(serverStatus === 'monitoring' ? "Monitoring active." : "Idle. Start monitoring from Configuration page.");
          addLogEntry({ message: `Initial status: ${serverStatus}, Config loaded.`, type: 'info' });
        } else {
          setConfig(null);
          setIsMonitoring(false);
          setCurrentStatus('idle');
          setStatusMessage("No active configuration. Please set up in Configuration page.");
          addLogEntry({ message: "No active configuration found.", type: 'warning' });
        }
      } catch (error) {
        addLogEntry({ message: "Failed to fetch initial app status.", type: 'error' });
        setCurrentStatus("error");
        setIsMonitoring(false);
        setConfig(null);
        setStatusMessage("Error fetching status. Please check logs.");
      }
    }
    fetchInitialStatusAndConfig();
  }, [addLogEntry]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    let connectTimeoutId: NodeJS.Timeout | undefined;
    let transferTimeoutId: NodeJS.Timeout | undefined;
    let successToMonitorTimeoutId: NodeJS.Timeout | undefined;

    const isCurrentlyProcessingSimulation = ['connecting', 'monitoring', 'transferring', 'success'].includes(currentStatus);

    if (isMonitoring && config) {
      if ((currentStatus === 'idle' || currentStatus === 'configuring') && !isCurrentlyProcessingSimulation) {
         // Check if config is present before logging to avoid error messages for valid states
        if(config.host) {
            addLogEntry({ message: `Starting monitoring for ${config.host}. Simulating connection...`, type: 'info' });
        }
        setCurrentStatus('connecting');
        setStatusMessage(config.host ? `Connecting to ${config.host}...` : 'Preparing to connect...');
      }

      if (currentStatus === 'connecting') {
        connectTimeoutId = setTimeout(() => {
          if (isMonitoring && config) { 
            setCurrentStatus('monitoring');
            setStatusMessage(`Monitoring ${config.remotePath} on ${config.host}.`);
            addLogEntry({ message: `Successfully connected. Monitoring ${config.remotePath}.`, type: 'info' });
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
                addLogEntry({ message: "Configuration was lost. Monitoring stopped.", type: 'error' });
            }
            return;
          }

          addLogEntry({ message: `Checking for files on ${currentConfigInInterval.host}...`, type: 'info' });
          const outcome = Math.random();

          if (outcome < 0.1) { 
            addLogEntry({ message: `Error during check on ${currentConfigInInterval.host}.`, type: 'error' });
            setCurrentStatus('error');
            setStatusMessage(`Error checking ${currentConfigInInterval.host}.`);
          } else if (outcome < 0.6) { 
            addLogEntry({ message: `No new files found.`, type: 'info' });
            setStatusMessage(`Last check: No new files. Monitoring ${currentConfigInInterval.remotePath}.`);
          } else { 
            setCurrentStatus('transferring');
            const fileName = `sim_file_${Date.now().toString().slice(-5)}_${Math.random().toString(36).substring(2, 7)}.dat`;
            addLogEntry({ message: `New file '${fileName}' detected. Simulating transfer...`, type: 'info' });
            setStatusMessage(`Transferring '${fileName}'...`);

            transferTimeoutId = setTimeout(async () => { 
               if (isMonitoring && config) { 
                const saveResult = await saveSimulatedFile(config.localPath, fileName);
                if (saveResult.success) {
                  addLogEntry({ message: `File '${fileName}' successfully transferred to ${config.localPath} and saved.`, type: 'success' });
                } else {
                  addLogEntry({ message: `File '${fileName}' transferred (simulated) but failed to save locally: ${saveResult.message}`, type: 'warning' });
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
  }, [isMonitoring, config, addLogEntry, addFetchedFile, currentStatus]); 


  const handleStopMonitoring = () => {
    if (!config) {
      addLogEntry({ message: "Cannot stop monitoring, no configuration active.", type: 'warning' });
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
          addLogEntry({ message: "User stopped monitoring.", type: 'info' });
        } else {
          addLogEntry({ message: `Failed to stop monitoring: ${response.message}`, type: 'error' });
          setStatusMessage(`Failed to stop monitoring: ${response.message}`);
        }
      } catch (error) {
        addLogEntry({ message: "Error when trying to stop monitoring.", type: 'error' });
        setStatusMessage("An unexpected error occurred while stopping monitoring.");
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
        
        {!config && currentStatus !== 'configuring' && (
          <Card>
            <CardHeader>
              <CardTitle>No Configuration Active</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">FTP monitoring requires an active configuration. Please go to the Configuration page to set up your FTP details.</p>
              <Link href="/configuration" passHref>
                <Button>Go to Configuration</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <FetchedFilesList files={fetchedFiles} />
        
        {logs.length > 0 && (
          <Card className="w-full shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Activity className="mr-2 h-5 w-5 text-blue-500" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm max-h-60 overflow-y-auto">
              <ul className="space-y-1">
                {logs.map(log => (
                  <li key={log.id} className={`flex items-center ${log.type === 'error' ? 'text-destructive' : log.type === 'success' ? 'text-green-600' : log.type === 'warning' ? 'text-yellow-600' : ''}`}>
                    <span className="text-xs text-muted-foreground mr-2">{new Date(log.timestamp).toLocaleTimeString()}:</span>
                    {log.message}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} FileFetcher App. FTP Activity.</p>
      </footer>
    </div>
  );
}
