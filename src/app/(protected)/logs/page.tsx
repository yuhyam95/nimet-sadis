"use client";

import React, { useState, useCallback, useEffect } from "react";
import { StatusDisplay } from "@/components/status-display";
import type { LogEntry, AppStatus } from "@/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getAppStatusAndLogs } from "@/lib/actions"; 
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AppStatus>("idle");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const addUiLogEntry = useCallback((newLog: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prevLogs) => [
      { ...newLog, id: crypto.randomUUID(), timestamp: new Date() },
      ...prevLogs,
    ].slice(0, 100));
  }, []);

  const fetchLogPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status, logs: serverLogs } = await getAppStatusAndLogs();
      setLogs(serverLogs);
      setCurrentStatus(status); 
      addUiLogEntry({ message: "Refreshed logs and status from server.", type: 'info' });
    } catch (error) {
      addUiLogEntry({ message: "Failed to fetch log page data.", type: 'error' });
      setCurrentStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, [addUiLogEntry]); 

  useEffect(() => {
    addUiLogEntry({ message: "Navigated to Logs page.", type: 'info' });
    fetchLogPageData();
  }, [fetchLogPageData, addUiLogEntry]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">
            Operation Logs & Status
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Review application status and operation logs.
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
            <p className="text-center text-muted-foreground">Loading status and logs...</p>
        ) : (
            <StatusDisplay
            logs={logs} 
            status={currentStatus}
            />
        )}
      </main>
      <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Logs Viewer.</p>
      </footer>
    </div>
  );
} 