
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FileFetcherForm } from "@/components/file-fetcher-form";
import type { AppConfig, LogEntry, AppStatus } from "@/types"; // Changed FtpConfig to AppConfig
import { getAppStatusAndLogs } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";


export default function ConfigurationPage() {
  const [config, setConfig] = useState<AppConfig | null>(null); // Changed FtpConfig to AppConfig
  const [formLogs, setFormLogs] = useState<LogEntry[]>([]);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");

  const addFormLog = useCallback((newLog: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setFormLogs((prevLogs) => [
      { ...newLog, id: crypto.randomUUID(), timestamp: new Date() },
      ...prevLogs,
    ].slice(0, 10));
  }, []); 

  const handleConfigChange = useCallback((newConfig: AppConfig) => { // Changed FtpConfig to AppConfig
    setConfig(newConfig);
  }, []); 

  const stableSetIsMonitoring = useCallback((monitoringState: boolean) => {
    setIsMonitoring(monitoringState);
  }, []); 

  useEffect(() => {
    let isMounted = true;
    async function fetchInitialData() {
      if (!isMounted) return;
      setPageStatus("loading");
      try {
        const { status, config: serverConfig } = await getAppStatusAndLogs(); // serverConfig is AppConfig | null
        if (!isMounted) return;

        if (serverConfig) {
          setConfig(serverConfig);
          setIsMonitoring(status === 'monitoring'); // status is AppStatus, this is fine
          addFormLog({ message: "Successfully loaded existing configuration.", type: 'info' });
        } else {
          addFormLog({ message: "No existing configuration found. Please enter new details.", type: 'info' });
        }
        if (isMounted) setPageStatus("ready");
      } catch (error) {
        if (!isMounted) return;
        addFormLog({ message: "Failed to load initial configuration.", type: 'error' });
        if (isMounted) setPageStatus("error");
      }
    }
    fetchInitialData();

    return () => {
      isMounted = false;
    };
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
            initialConfig={config || undefined} // config is now AppConfig | null
            isCurrentlyMonitoring={isMonitoring}
            setIsCurrentlyMonitoring={stableSetIsMonitoring}
          />
        )}
        
      </main>
      <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Configuration Management.</p>
      </footer>
    </div>
  );
}
