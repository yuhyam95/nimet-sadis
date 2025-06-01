
"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { FtpConfig, LogEntry, AppStatus } from "@/types";
import { getAppStatusAndLogs, toggleMonitoring, saveSimulatedFile } from "@/lib/actions"; // Added saveSimulatedFile
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Rss, Activity, Loader2 as InitialLoader, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Minimal StatusDisplay for this page
const MinimalStatusDisplay: React.FC<{ status: AppStatus; isMonitoring: boolean; message?: string }> = ({ status, isMonitoring, message }) => {
  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let badgeText = "Idle";
  let IconComponent: React.ElementType = Activity;

  if (status === 'configuring') {
    badgeVariant = "outline";
    badgeText = "Initializing...";
    IconComponent = InitialLoader; // Use InitialLoader (renamed Loader2)
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
          Monitoring Status
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
    ].slice(0, 20)); // Keep only the last 20 logs for this page
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
      setStatusMessage("Initializing application status...");
      try {
        const { status: serverStatus, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setConfig(serverConfig);
          setIsMonitoring(serverStatus === 'monitoring');
          setCurrentStatus(serverStatus === 'monitoring' ? 'monitoring' : 'idle'); // Adjust initial status
          setStatusMessage(serverStatus === 'monitoring' ? "Actively monitoring for files." : "Idle. Start monitoring from Configuration page.");
        } else {
          setConfig(null);
          setIsMonitoring(false);
          setCurrentStatus('idle');
          setStatusMessage("No active configuration. Please set up in Configuration page.");
        }
      } catch (error) {
        addLogEntry({ message: "Failed to fetch initial app status.", type: 'error' });
        setCurrentStatus("error");
        setIsMonitoring(false);
        setConfig(null);
        setStatusMessage("Error fetching status. Please try again or check logs.");
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
      // Only set to 'connecting' if we are coming from 'idle' or 'configuring' and not already in a processing state
      if ((currentStatus === 'idle' || currentStatus === 'configuring') && !isCurrentlyProcessingSimulation) {
        addLogEntry({ message: `Monitoring active for ${config.host}. Simulating connection...`, type: 'info' });
        setCurrentStatus('connecting');
        setStatusMessage(`Connecting to ${config.host}...`);
      }

      if (currentStatus === 'connecting') {
        connectTimeoutId = setTimeout(() => {
          if (isMonitoring && config) { // Re-check config and monitoring status
            setCurrentStatus('monitoring');
            setStatusMessage(`Monitoring ${config.remotePath} on ${config.host}.`);
            addLogEntry({ message: `Successfully connected to ${config.host}. Monitoring ${config.remotePath}.`, type: 'info' });
          }
        }, 1500); // Simulate connection time
      }

      if (currentStatus === 'monitoring') {
        intervalId = setInterval(async () => { // Make interval callback async
          const currentConfigInInterval = config; // Capture config at interval start
          if (!currentConfigInInterval || !isMonitoring) { // Check if monitoring stopped or config lost
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

          if (outcome < 0.1) { // Simulate an error
            addLogEntry({ message: `Error during check on FTP server ${currentConfigInInterval.host}.`, type: 'error' });
            setCurrentStatus('error');
            setStatusMessage(`Error checking ${currentConfigInInterval.host}.`);
          } else if (outcome < 0.6) { // Simulate no new files
            addLogEntry({ message: `No new files found on ${currentConfigInInterval.host}.`, type: 'info' });
            setStatusMessage(`Last check: No new files. Monitoring ${currentConfigInInterval.remotePath}.`);
          } else { // Simulate new file found
            setCurrentStatus('transferring');
            const fileName = `sim_file_${Date.now().toString().slice(-5)}_${Math.random().toString(36).substring(2, 7)}.dat`;
            addLogEntry({ message: `New file '${fileName}' detected. Simulating transfer...`, type: 'info' });
            setStatusMessage(`Transferring '${fileName}'...`);

            transferTimeoutId = setTimeout(async () => { // Make timeout callback async
               if (isMonitoring && config) { // Re-check monitoring status and config
                // Attempt to save the simulated file
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
                  if (isMonitoring && config) { // Re-check before returning to monitoring
                      setCurrentStatus('monitoring');
                      setStatusMessage(`Monitoring ${config.remotePath} on ${config.host}.`);
                  }
                }, 2000); // Delay before returning to monitoring state
              }
            }, 2500); // Simulate transfer time
          }
        }, (config.interval || 5) * 1000 * 0.5 ); // Adjusted interval for more frequent checks in simulation
      }
    } else if (!isMonitoring && isCurrentlyProcessingSimulation) {
        // If monitoring was stopped while in a processing state, reset to idle
        setCurrentStatus('idle');
        setStatusMessage(config ? "Monitoring paused." : "No active configuration. Please set up in Configuration page.");
    } else if (!isMonitoring && !config && currentStatus !== 'idle' && currentStatus !== 'error' && currentStatus !== 'configuring') {
        // If no config and not monitoring, ensure idle state
        setCurrentStatus('idle');
        setStatusMessage("No active configuration. Please set up in Configuration page.");
    }


    return () => {
      if (intervalId) clearInterval(intervalId);
      if (connectTimeoutId) clearTimeout(connectTimeoutId);
      if (transferTimeoutId) clearTimeout(transferTimeoutId);
      if (successToMonitorTimeoutId) clearTimeout(successToMonitorTimeoutId);
    };
  }, [isMonitoring, config, addLogEntry, addFetchedFile, currentStatus]); // currentStatus is needed here to manage transitions


  const handleStopMonitoring = () => {
    if (!config) {
      addLogEntry({ message: "Cannot stop monitoring, no configuration active.", type: 'warning' });
      return;
    }
    setIsStopping(true);
    startToggleTransition(async () => {
      try {
        const response = await toggleMonitoring(false); // Request to stop monitoring
        if (response.success) {
          setIsMonitoring(false);
          setCurrentStatus('idle');
          setStatusMessage("Monitoring stopped by user.");
          addLogEntry({ message: "User stopped monitoring.", type: 'info' });
        } else {
          addLogEntry({ message: `Failed to stop monitoring: ${response.message}`, type: 'error' });
          // Potentially revert UI or keep as is, server state is king
        }
      } catch (error) {
        addLogEntry({ message: "Error when trying to stop monitoring.", type: 'error' });
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
            FTP Activity
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Live (simulated) feed of file transfers and monitoring status.
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
        
        {logs.length > 0 && (
          <Card className="w-full shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Activity className="mr-2 h-5 w-5 text-blue-500" /> Activity Log
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
        <p>&copy; {new Date().getFullYear()} FileFetcher App. FTP Activity Viewer.</p>
      </footer>
    </div>
  );
}
