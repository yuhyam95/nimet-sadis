
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { FileFetcherForm } from "@/components/file-fetcher-form";
import { StatusDisplay } from "@/components/status-display";
import type { FtpConfig, LogEntry, AppStatus } from "@/types";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { getAppStatusAndLogs } from "@/lib/actions"; 

export default function FileFetcherPage() {
  const [config, setConfig] = useState<FtpConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AppStatus>("idle");
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const { toast } = useToast();

  const addLogEntry = useCallback((newLog: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prevLogs) => [
      { ...newLog, id: crypto.randomUUID(), timestamp: new Date() },
      ...prevLogs,
    ].slice(0, 100)); 
  }, []);
  
  const handleConfigChange = useCallback((newConfig: FtpConfig) => {
    setConfig(newConfig);
    // Initial status will be set by the main useEffect when isMonitoring becomes true
    addLogEntry({ message: `Configuration updated for ${newConfig.host}`, type: 'info' });
  }, [addLogEntry]);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const { status: serverStatus, logs: serverLogs, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setConfig(serverConfig);
        }
        // Only set isMonitoring based on serverStatus if there's a config,
        // otherwise, it might conflict with user actions before config is set.
        if (serverConfig) {
            setIsMonitoring(serverStatus === 'monitoring');
        }
        setCurrentStatus(serverConfig && serverStatus === 'monitoring' ? 'monitoring' : 'idle');
      } catch (error) {
        addLogEntry({ message: "Failed to fetch app status.", type: 'error' });
        setCurrentStatus("error");
      }
    }
    fetchStatus();
  }, [addLogEntry]); // Removed setCurrentStatus and setIsMonitoring as direct dependencies, they are setters.

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    let initialSetupTimeoutId: NodeJS.Timeout | undefined; 
    let transferSuccessTimeoutId: NodeJS.Timeout | undefined;
    let successToMonitoringTimeoutId: NodeJS.Timeout | undefined;


    if (isMonitoring && config) {
      const isAlreadyProcessing = 
        currentStatus === 'connecting' ||
        currentStatus === 'monitoring' ||
        currentStatus === 'transferring' ||
        currentStatus === 'success';

      if (!isAlreadyProcessing) {
        addLogEntry({ message: `Simulating check for new files on ${config.host}...`, type: 'info' });
        setCurrentStatus('connecting');
      }
      
      if (currentStatus === 'connecting') {
        initialSetupTimeoutId = setTimeout(() => {
          if (isMonitoring && config) { 
            setCurrentStatus('monitoring');
          }
        }, 1000);
      }
      
      intervalId = setInterval(() => {
        const currentConfigInInterval = config; 
        const outcome = Math.random();

        if (outcome < 0.1) { 
          addLogEntry({ message: `Error connecting to FTP server ${currentConfigInInterval.host}.`, type: 'error' });
          setCurrentStatus('error');
          setIsMonitoring(false); 
          toast({
            title: "FTP Connection Error",
            description: `Could not connect to ${currentConfigInInterval.host}. Monitoring stopped.`,
            variant: "destructive",
          });
        } else if (outcome < 0.3) { 
          addLogEntry({ message: `No new files found on ${currentConfigInInterval.host}.`, type: 'info' });
          setCurrentStatus('monitoring');
        } else { 
          setCurrentStatus('transferring');
          const fileName = `file_${Date.now()}.zip`;
          addLogEntry({ message: `New file '${fileName}' found. Starting transfer...`, type: 'info' });
          
          transferSuccessTimeoutId = setTimeout(() => {
            addLogEntry({ message: `File '${fileName}' successfully transferred to ${currentConfigInInterval.localPath}.`, type: 'success' });
            setCurrentStatus('success');
            
            successToMonitoringTimeoutId = setTimeout(() => {
                // Check isMonitoring and config again before setting back to monitoring
                // This requires access to the latest isMonitoring state.
                // A ref for isMonitoring would be more robust here if accessed from a long-running timeout.
                // For this simulation, if isMonitoring became false, the main interval cleanup should handle it.
                if (isMonitoring && config) { 
                    setCurrentStatus('monitoring');
                }
            }, 1500); 
            
             toast({
              title: "File Transferred",
              description: `${fileName} moved to ${currentConfigInInterval.localPath}.`,
            });
          }, 2000); 
        }
      }, (config.interval || 5) * 60 * 1000);

    } else if (!isMonitoring && currentStatus !== 'idle' && currentStatus !== 'error') {
        setCurrentStatus('idle');
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (initialSetupTimeoutId) clearTimeout(initialSetupTimeoutId);
      if (transferSuccessTimeoutId) clearTimeout(transferSuccessTimeoutId);
      if (successToMonitoringTimeoutId) clearTimeout(successToMonitoringTimeoutId);
    };
  }, [isMonitoring, config, currentStatus, addLogEntry, toast, setCurrentStatus, setIsMonitoring]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-primary tracking-tight">
          FileFetcher
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Automated FTP File Retrieval and Local Transfer
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <FileFetcherForm 
            onConfigChange={handleConfigChange} 
            addLog={addLogEntry} // Pass the memoized addLogEntry
            initialConfig={config || undefined}
            isCurrentlyMonitoring={isMonitoring}
            setIsCurrentlyMonitoring={setIsMonitoring}
        />
        <StatusDisplay 
            config={config} 
            logs={logs} 
            status={currentStatus}
            isMonitoring={isMonitoring}
        />
      </main>
      {/* Toaster already in layout.tsx, no need for a second one here */}
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} FileFetcher App. For demonstration purposes.</p>
      </footer>
    </div>
  );
}
