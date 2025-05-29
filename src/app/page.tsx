
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FileFetcherForm } from "@/components/file-fetcher-form";
import { StatusDisplay } from "@/components/status-display";
import type { FtpConfig, LogEntry, AppStatus } from "@/types";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { getAppStatusAndLogs } from "@/lib/actions"; // Assuming this action exists

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
    ].slice(0, 100)); // Keep last 100 logs
  }, []);
  
  const handleConfigChange = useCallback((newConfig: FtpConfig) => {
    setConfig(newConfig);
    setCurrentStatus("monitoring"); // Or 'configuring' then 'monitoring'
    addLogEntry({ message: `Configuration updated for ${newConfig.host}`, type: 'info' });
  }, [addLogEntry]);

  // Effect to fetch initial status or on config change
  useEffect(() => {
    async function fetchStatus() {
      try {
        // Simulating an initial fetch or update
        const { status: serverStatus, logs: serverLogs, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setConfig(serverConfig);
        }
        setIsMonitoring(serverStatus === 'monitoring');
        setCurrentStatus(serverStatus);
        // addLogEntry({ message: "Application status refreshed.", type: 'info' }); // Potentially too noisy
      } catch (error) {
        addLogEntry({ message: "Failed to fetch app status.", type: 'error' });
        setCurrentStatus("error");
      }
    }
    fetchStatus();
  }, [addLogEntry]);

  // Simulate periodic checks and file transfers if monitoring is active
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isMonitoring && config) {
      addLogEntry({ message: `Simulating check for new files on ${config.host}...`, type: 'info' });
      setCurrentStatus('connecting');

      intervalId = setInterval(() => {
        // Simulate different outcomes
        const outcome = Math.random();
        if (outcome < 0.1) { // Simulate error
          addLogEntry({ message: `Error connecting to FTP server ${config.host}.`, type: 'error' });
          setCurrentStatus('error');
          setIsMonitoring(false); // Stop monitoring on critical error simulation
          toast({
            title: "FTP Connection Error",
            description: `Could not connect to ${config.host}. Monitoring stopped.`,
            variant: "destructive",
          });
        } else if (outcome < 0.3) { // Simulate no new files
          addLogEntry({ message: `No new files found on ${config.host}.`, type: 'info' });
          setCurrentStatus('monitoring');
        } else { // Simulate file found and transferred
          setCurrentStatus('transferring');
          const fileName = `file_${Date.now()}.zip`;
          addLogEntry({ message: `New file '${fileName}' found. Starting transfer...`, type: 'info' });
          setTimeout(() => {
            addLogEntry({ message: `File '${fileName}' successfully transferred to ${config.localPath}.`, type: 'success' });
            setCurrentStatus('success');
            setTimeout(() => setCurrentStatus('monitoring'), 1500); // Back to monitoring after success display
             toast({
              title: "File Transferred",
              description: `${fileName} moved to ${config.localPath}.`,
            });
          }, 2000); // Simulate transfer time
        }
      }, (config.interval || 5) * 60 * 1000); // Use configured interval, default 5 mins

      // Initial check simulation
      setTimeout(() => {
         if(isMonitoring) setCurrentStatus('monitoring'); // Ensure status is monitoring after initial setup
      }, 1000);


    } else if (!isMonitoring && currentStatus !== 'idle' && currentStatus !== 'error') {
        setCurrentStatus('idle');
        // This log might be redundant if toggleMonitoring already logs stopping
        // addLogEntry({ message: "Monitoring stopped by user or due to inactivity.", type: 'info' });
    }


    return () => {
      clearInterval(intervalId);
    };
  }, [isMonitoring, config, addLogEntry, toast, currentStatus]);


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
            addLog={(logData) => addLogEntry(logData)}
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
      <Toaster />
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} FileFetcher App. For demonstration purposes.</p>
      </footer>
    </div>
  );
}
