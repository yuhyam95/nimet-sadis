
"use client";

import React, { useState, useEffect } from "react";
import { getAppStatusAndLogs } from "@/lib/actions";
import type { AppConfig } from "@/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Cloud, AlertTriangle, MountainSnow, Tornado } from "lucide-react";

export default function HomePage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(true);
      try {
        const statusResponse = await getAppStatusAndLogs();
        setConfig(statusResponse.config);
      } catch (error) {
        console.error("Failed to fetch initial data for home page:", error);
        setConfig(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-4xl flex items-center justify-between">
        <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-primary tracking-tight">
            Welcome to NiMet-SADIS
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
                <Cloud className="mr-3 h-7 w-7 text-primary" />
                OPMET
              </CardTitle>
              <CardDescription>
                Access operational meteorological information like METAR, TAF, and SPECI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>View OPMET Data</Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <AlertTriangle className="mr-3 h-7 w-7 text-primary" />
                SIGMET
              </CardTitle>
              <CardDescription>
                Monitor significant meteorological phenomena hazardous to aviation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>View SIGMETs</Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <MountainSnow className="mr-3 h-7 w-7 text-primary" />
                Volcanic Ash Products
              </CardTitle>
              <CardDescription>
                Access advisories and graphics for volcanic ash clouds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>View Volcanic Ash Data</Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl">
                <Tornado className="mr-3 h-7 w-7 text-primary" />
                Tropical Cyclone Products
              </CardTitle>
              <CardDescription>
                Track and view advisories for tropical cyclones and hurricanes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>View Cyclone Data</Button>
            </CardContent>
          </Card>
        </div>
        
        {isLoading && (
          <div className="flex justify-center items-center p-8">
             <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading dashboard...</p>
          </div>
        )}
      </main>
       <footer className="w-full max-w-4xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Dashboard.</p>
      </footer>
    </div>
  );
}
