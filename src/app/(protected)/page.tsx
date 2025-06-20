
"use client";

import React, { useState, useEffect } from "react";
import { getAppStatusAndLogs } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import type { AppConfig, SessionPayload } from "@/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Network, Code, PlayCircle, Loader2 } from "lucide-react";

export default function HomePage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(true);
      try {
        const [statusResponse, sessionData] = await Promise.all([
          getAppStatusAndLogs(),
          getSession()
        ]);
        setConfig(statusResponse.config);
        setSession(sessionData);
      } catch (error) {
        console.error("Failed to fetch initial data for home page:", error);
        setConfig(null);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  const isAdmin = session?.roles?.includes('admin') ?? false;

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
        
        {isLoading && (
          <div className="flex justify-center items-center p-8">
             <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading dashboard...</p>
          </div>
        )}

        {!isLoading && !config && isAdmin && (
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
