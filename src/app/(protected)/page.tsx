
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getAppStatusAndLogs } from "@/lib/actions";
import type { AppConfig } from "@/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Network, Code, PlayCircle } from "lucide-react";

export default function HomePage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    async function fetchConfigStatus() {
      setIsLoadingConfig(true);
      try {
        const { config: serverConfig } = await getAppStatusAndLogs();
        setConfig(serverConfig);
      } catch (error) {
        console.error("Failed to fetch initial app status for home page:", error);
        setConfig(null);
      } finally {
        setIsLoadingConfig(false);
      }
    }
    fetchConfigStatus();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-4xl flex items-center justify-between">
        <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-primary tracking-tight">
            Welcome to NiMet-SADIS-Ingest
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Automated SADIS FTP file ingestion and local transfer. Select an option below or use the sidebar.
            </p>
        </div>
        <div className="md:hidden">
            <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-4xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <Network className="mr-3 h-7 w-7 text-primary" />
                FTP Files & Activity
              </CardTitle>
              <CardDescription>
                View recently fetched files, monitor FTP server activity, and manage transfers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/ftp-activity" passHref>
                <Button className="w-full">Go to FTP Activity</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <Code className="mr-3 h-7 w-7 text-primary" />
                API Management
              </CardTitle>
              <CardDescription>
                Configure API endpoints and manage integrations. (Placeholder for future functionality)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/api-placeholder" passHref>
                <Button className="w-full" disabled>Go to API Settings</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        
        {isLoadingConfig && (
          <div className="flex justify-center items-center p-8">
            <p className="text-muted-foreground">Loading configuration status...</p>
          </div>
        )}

        {!isLoadingConfig && !config && (
          <Card className="shadow-lg border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <PlayCircle className="mr-3 h-7 w-7 text-primary" />
                Get Started
              </CardTitle>
              <CardDescription>
                No FTP configuration found. Set up your FTP details to begin monitoring and fetching files.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Navigate to the Configuration page to input your FTP server credentials, paths, and monitoring preferences.
              </p>
              <Link href="/configuration" passHref>
                <Button className="w-full">Go to Configuration</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
       <footer className="w-full max-w-4xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. Dashboard.</p>
      </footer>
    </div>
  );
}
