
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { FtpConfig, LogEntry, AppStatus } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getAppStatusAndLogs } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // For consistency
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Rss, Activity } from "lucide-react";

// Minimal StatusDisplay for this page
const MinimalStatusDisplay: React.FC<{ status: AppStatus; isMonitoring: boolean; message?: string }> = ({ status, isMonitoring, message }) => {
  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let badgeText = "Idle";
  let IconComponent = Activity;

  if (isMonitoring) {
    switch (status) {
      case 'monitoring': badgeVariant = "default"; badgeText = "Monitoring"; IconComponent = Rss; break;
      case 'connecting': badgeVariant = "outline"; badgeText = "Connecting..."; IconComponent = Activity; break;
      case 'transferring': badgeVariant = "outline"; badgeText = "Transferring..."; IconComponent = Activity; break;
      case 'success': badgeVariant = "default"; badgeText = "File Transfer Success"; IconComponent = CheckCircle2; break;
      case 'error': badgeVariant = "destructive"; badgeText = "Error"; IconComponent = AlertCircle; break;
      default: badgeText = "Standby"; IconComponent = Rss; break; // Default for isMonitoring true but unknown status
    }
  } else if (status === 'error') {
    badgeVariant = "destructive"; badgeText = "Error"; IconComponent = AlertCircle;
  } else {
    badgeText = "Idle"; // Default when not monitoring and not an error
    IconComponent = Activity;
  }

  return (
    <Card className="w-full shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-xl">
          <IconComponent className={`mr-2 h-5 w-5 ${isMonitoring && status !== 'error' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-primary'}`} />
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
  const [currentStatus, setCurrentStatus] = useState<AppStatus>("idle");
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [fetchedFiles, setFetchedFiles] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing...");
  const { toast } = useToast();

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
      try {
        const { status: serverStatus, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setConfig(serverConfig);
          setIsMonitoring(serverStatus === 'monitoring');
          setCurrentStatus(serverStatus === 'monitoring' ? 'monitoring' : 'idle');
          setStatusMessage(serverStatus === 'monitoring' ? "Actively monitoring for files." : "Idle. Start monitoring from Configuration page.");
        } else {
          setStatusMessage("No active configuration. Please set up in Configuration page.");
          setCurrentStatus('idle');
          setIsMonitoring(false);
          setConfig(null); // Ensure config is null if not fetched
        }
      } catch (error) {
        addLogEntry({ message: "Failed to fetch initial app status.", type: 'error' });
        setCurrentStatus("error");
        setStatusMessage("Error fetching status.");
      }
    }
    fetchInitialStatusAndConfig();
  }, [addLogEntry]); // addLogEntry is stable

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    let connectTimeoutId: NodeJS.Timeout | undefined;
    let transferTimeoutId: NodeJS.Timeout | undefined;
    let successToMonitorTimeoutId: NodeJS.Timeout | undefined;

    const isAlreadyProcessing = ['connecting', 'monitoring', 'transferring', 'success'].includes(currentStatus);

    if (isMonitoring && config) {
      if ((currentStatus === 'idle' || currentStatus === 'configuring') && !isAlreadyProcessing) {
        addLogEntry({ message: `Monitoring active. Simulating connection to ${config.host}...`, type: 'info' });
        setCurrentStatus('connecting');
        setStatusMessage(`Connecting to ${config.host}...`);
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
        intervalId = setInterval(() => {
          const currentConfigInInterval = config;
          if (!currentConfigInInterval) {
            setIsMonitoring(false);
            setCurrentStatus('error');
            setStatusMessage("Configuration lost during monitoring.");
            return;
          }

          addLogEntry({ message: `Checking for files on ${currentConfigInInterval.host}...`, type: 'info' });
          const outcome = Math.random();

          if (outcome < 0.1) {
            addLogEntry({ message: `Error during check on FTP server ${currentConfigInInterval.host}.`, type: 'error' });
            setCurrentStatus('error');
            setStatusMessage(`Error checking ${currentConfigInInterval.host}. Monitoring may be paused.`);
            toast({
              title: "FTP Check Error",
              description: `An error occurred while checking ${currentConfigInInterval.host}.`,
              variant: "destructive",
            });
          } else if (outcome < 0.6) {
            addLogEntry({ message: `No new files found on ${currentConfigInInterval.host}.`, type: 'info' });
            setStatusMessage(`Last check: No new files. Monitoring ${currentConfigInInterval.remotePath}.`);
          } else {
            setCurrentStatus('transferring');
            const fileName = `sim_file_${Date.now().toString().slice(-5)}_${Math.random().toString(36).substring(2, 7)}.dat`;
            addLogEntry({ message: `New file '${fileName}' detected. Simulating transfer...`, type: 'info' });
            setStatusMessage(`Transferring '${fileName}'...`);

            transferTimeoutId = setTimeout(() => {
              addLogEntry({ message: `File '${fileName}' successfully transferred to ${currentConfigInInterval.localPath}.`, type: 'success' });
              addFetchedFile(fileName);
              setCurrentStatus('success');
              setStatusMessage(`Successfully transferred '${fileName}'.`);
              toast({
                title: "File Transferred (Simulated)",
                description: `${fileName} processed from ${currentConfigInInterval.host}.`,
              });

              successToMonitorTimeoutId = setTimeout(() => {
                if (isMonitoring && config) {
                    setCurrentStatus('monitoring');
                    setStatusMessage(`Monitoring ${config.remotePath} on ${config.host}.`);
                }
              }, 2000);
            }, 2500);
          }
        }, (config.interval || 5) * 1000 * 0.5);
      }
    } else if (!isMonitoring && (currentStatus !== 'idle' && currentStatus !== 'error')) {
        setCurrentStatus('idle');
        setStatusMessage(config ? "Monitoring paused. Start from Configuration page." : "No active configuration.");
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (connectTimeoutId) clearTimeout(connectTimeoutId);
      if (transferTimeoutId) clearTimeout(transferTimeoutId);
      if (successToMonitorTimeoutId) clearTimeout(successToMonitorTimeoutId);
    };
  }, [isMonitoring, config, currentStatus, addLogEntry, toast, addFetchedFile]);


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
        <FetchedFilesList files={fetchedFiles} />
      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} FileFetcher App. FTP Activity Viewer.</p>
      </footer>
    </div>
  );
}
