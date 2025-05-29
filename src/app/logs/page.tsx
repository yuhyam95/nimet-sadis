
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { StatusDisplay } from "@/components/status-display";
import type { LogEntry, AppStatus, FtpConfig } from "@/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getAppStatusAndLogs } from "@/lib/actions"; // Assuming we might fetch some initial static logs or status

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AppStatus>("idle");
  const [config, setConfig] = useState<FtpConfig | null>(null); // Logs page might not need full config awareness

  const addLogEntry = useCallback((newLog: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prevLogs) => [
      { ...newLog, id: crypto.randomUUID(), timestamp: new Date() },
      ...prevLogs,
    ].slice(0, 100));
  }, []);

  useEffect(() => {
    // Simulate fetching initial static logs or status if needed for a dedicated logs page
    async function fetchInitialData() {
        try {
            // For now, this mainly gets config if available, logs are dynamic on FTP page
            const { status, logs: serverLogs, config: serverConfig } = await getAppStatusAndLogs();
            // setLogs(serverLogs); // serverLogs from getAppStatusAndLogs is currently always []
            if (serverConfig) {
                setConfig(serverConfig)
            }
            setCurrentStatus(status); // Reflect general app status
            addLogEntry({ message: "Navigated to Logs page.", type: 'info' });
        } catch (error) {
            addLogEntry({ message: "Failed to fetch initial log page data.", type: 'error' });
        }
    }
    fetchInitialData();
  }, [addLogEntry]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">
            Application Logs
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Review events and status messages from the FileFetcher application.
          </p>
        </div>
        <div className="md:hidden">
            <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        {/* StatusDisplay will show logs generated on this page or initial ones */}
        {/* It won't show logs from the FTP page unless log state is shared/persisted */}
        <StatusDisplay
          config={config} // Pass config if relevant for display, or null
          logs={logs}
          status={currentStatus}
          isMonitoring={currentStatus === 'monitoring'} // Logs page itself isn't "monitoring" files
        />
        {/* You could add more specific log filtering or interaction components here in the future */}
      </main>
      <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} FileFetcher App. Logs Viewer.</p>
      </footer>
    </div>
  );
}
