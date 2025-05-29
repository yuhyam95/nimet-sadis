
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FileFetcherForm } from "@/components/file-fetcher-form";
import type { FtpConfig, LogEntry, AppStatus } from "@/types";
import { getAppStatusAndLogs } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info } from "lucide-react";


export default function ConfigurationPage() {
  const [config, setConfig] = useState<FtpConfig | null>(null);
  const [formLogs, setFormLogs] = useState<LogEntry[]>([]);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");

  const addFormLog = useCallback((newLog: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setFormLogs((prevLogs) => [
      { ...newLog, id: crypto.randomUUID(), timestamp: new Date() },
      ...prevLogs,
    ].slice(0, 10));
  }, []); // setFormLogs is stable

  const handleConfigChange = useCallback((newConfig: FtpConfig) => {
    setConfig(newConfig);
    // The form submission itself handles logging and starting monitoring via server action
  }, []); // setConfig is stable

  const stableSetIsMonitoring = useCallback((monitoringState: boolean) => {
    setIsMonitoring(monitoringState);
  }, []); // setIsMonitoring is stable

  // Fetch initial config and monitoring status
  useEffect(() => {
    async function fetchInitialData() {
      setPageStatus("loading");
      try {
        const { status, config: serverConfig } = await getAppStatusAndLogs();
        if (serverConfig) {
          setConfig(serverConfig);
          setIsMonitoring(status === 'monitoring');
          addFormLog({ message: "Successfully loaded existing configuration.", type: 'info' });
        } else {
          addFormLog({ message: "No existing configuration found. Please enter new details.", type: 'info' });
        }
        setPageStatus("ready");
      } catch (error) {
        addFormLog({ message: "Failed to load initial configuration.", type: 'error' });
        setPageStatus("error");
      }
    }
    fetchInitialData();
  }, [addFormLog]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">
            FTP Configuration
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Setup and manage your FTP connection and monitoring settings.
          </p>
        </div>
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        {pageStatus === "loading" && <p>Loading configuration...</p>}
        {pageStatus === "error" && (
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center text-destructive">
                        <AlertTriangle className="mr-2"/> Error Loading Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Could not retrieve the current FTP configuration. Please try refreshing the page. If the problem persists, check server logs.</p>
                </CardContent>
            </Card>
        )}
        {pageStatus === "ready" && (
          <FileFetcherForm
            onConfigChange={handleConfigChange} 
            addLog={addFormLog}
            initialConfig={config || undefined}
            isCurrentlyMonitoring={isMonitoring}
            setIsCurrentlyMonitoring={stableSetIsMonitoring}
          />
        )}
        
        {formLogs.length > 0 && (
          <Card className="w-full shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Info className="mr-2 h-5 w-5 text-blue-500" />
                Configuration Events
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="space-y-1">
                {formLogs.map(log => (
                  <li key={log.id} className={`flex items-center ${log.type === 'error' ? 'text-destructive' : log.type === 'success' ? 'text-green-600' : ''}`}>
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
        <p>&copy; {new Date().getFullYear()} FileFetcher App. Configuration Management.</p>
      </footer>
    </div>
  );
}
