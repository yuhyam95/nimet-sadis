
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { StatusDisplay } from "@/components/status-display";
import type { LogEntry, AppStatus, FtpConfig } from "@/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getAppStatusAndLogs } from "@/lib/actions"; 
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AppStatus>("idle");
  const [config, setConfig] = useState<FtpConfig | null>(null); // This FtpConfig might need to become AppConfig if we show multi-folder config here
  const [isMonitoringSim, setIsMonitoringSim] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // This client-side log adding is for UI events on THIS page, not for FTP logs from server.
  const addUiLogEntry = useCallback((newLog: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prevLogs) => [
      { ...newLog, id: crypto.randomUUID(), timestamp: new Date() },
      ...prevLogs,
    ].slice(0, 100)); // Keep client-side logs also capped for this page display
  }, []);

  const fetchLogPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status, logs: serverLogs, config: serverConfig } = await getAppStatusAndLogs();
      
      setLogs(serverLogs); // serverLogs are now the FTP logs, newest first if addFtpLog prepends
      
      if (serverConfig) {
        // @ts-ignore // Temporarily allow FtpConfig, ideally StatusDisplay adapts or config type here changes
        setConfig(serverConfig.server); // Show main server config for now, or update StatusDisplay for AppConfig
      } else {
        setConfig(null);
      }
      setCurrentStatus(status); 
      setIsMonitoringSim(status === 'monitoring'); 

      addUiLogEntry({ message: "Refreshed FTP logs and status from server.", type: 'info' });

    } catch (error) {
      addUiLogEntry({ message: "Failed to fetch log page data.", type: 'error' });
      setCurrentStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, [addUiLogEntry]); 

  useEffect(() => {
    addUiLogEntry({ message: "Navigated to FTP Logs page.", type: 'info' });
    fetchLogPageData();
  }, [fetchLogPageData, addUiLogEntry]); 


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">
            FTP Operation Logs & Status
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Review FTP server interactions and the overall application status.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={fetchLogPageData} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Logs
            </Button>
            <div className="md:hidden">
                <SidebarTrigger />
            </div>
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        {isLoading && !logs.length ? (
            <p className="text-center text-muted-foreground">Loading status and FTP logs...</p>
        ) : (
            <StatusDisplay
            config={config} // This might need to be AppConfig or StatusDisplay adjusted
            logs={logs} 
            status={currentStatus}
            isMonitoring={isMonitoringSim} 
            />
        )}
      </main>
      <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. FTP Logs Viewer.</p>
      </footer>
    </div>
  );
}

    