
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
  const [config, setConfig] = useState<FtpConfig | null>(null);
  const [isMonitoringSim, setIsMonitoringSim] = useState<boolean>(false); // Renamed to avoid conflict
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const addLogEntry = useCallback((newLog: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prevLogs) => [
      { ...newLog, id: crypto.randomUUID(), timestamp: new Date() },
      ...prevLogs,
    ].slice(0, 100));
  }, []);

  const fetchLogPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Logs from getAppStatusAndLogs is currently always [], so we primarily get config and status
      const { status, logs: serverLogs, config: serverConfig } = await getAppStatusAndLogs();
      
      // For this page, we'll start with a fresh log set or one reflecting current action
      // setLogs(serverLogs); 
      
      if (serverConfig) {
        setConfig(serverConfig);
      }
      setCurrentStatus(status); // Reflect general app status from server
      setIsMonitoringSim(status === 'monitoring'); // Update based on actual server status

      addLogEntry({ message: "Refreshed logs and status from server.", type: 'info' });

    } catch (error) {
      addLogEntry({ message: "Failed to fetch log page data.", type: 'error' });
      setCurrentStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, [addLogEntry]); // addLogEntry is stable

  useEffect(() => {
    addLogEntry({ message: "Navigated to Logs page.", type: 'info' });
    fetchLogPageData();
  }, [fetchLogPageData, addLogEntry]); // Initial fetch and setup


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">
            Application Logs & Status
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Review events and the overall application status.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={fetchLogPageData} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
            <div className="md:hidden">
                <SidebarTrigger />
            </div>
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        {isLoading && !logs.length ? (
            <p className="text-center text-muted-foreground">Loading status and logs...</p>
        ) : (
            <StatusDisplay
            config={config}
            logs={logs} // Shows logs generated on this page + initial server log messages
            status={currentStatus}
            isMonitoring={isMonitoringSim} // Use the state derived from getAppStatusAndLogs
            />
        )}
      </main>
      <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} FileFetcher App. Logs Viewer.</p>
      </footer>
    </div>
  );
}
