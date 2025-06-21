
"use client";

import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getSession, getAppStatusAndLogs } from "@/lib/actions";
import type { AppConfig, SessionPayload } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Cloud, AlertTriangle, MountainSnow, Tornado } from "lucide-react";

export default function HomePage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionPayload | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [statusResponse, sessionData] = await Promise.all([
          getAppStatusAndLogs(),
          getSession()
        ]);
        if (statusResponse.config) {
          setConfig(statusResponse.config);
        }
        setSession(sessionData);
      } catch (error) {
        console.error("Failed to fetch initial data for homepage:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const dataProducts = [
    {
      title: "OPMET",
      description: "Access Operational Meteorological data including METAR, TAF, and SPECI reports.",
      href: "/opmet",
      icon: Cloud,
    },
    {
      title: "SIGMET",
      description: "Monitor significant meteorological phenomena hazardous to aviation.",
      href: "/sigmet",
      icon: AlertTriangle,
    },
    {
      title: "Volcanic Ash Products",
      description: "View advisories and graphical products for volcanic ash clouds.",
      href: "/volcanic-ash",
      icon: MountainSnow,
    },
    {
      title: "Tropical Cyclone Products",
      description: "Track and view advisories and graphical data for tropical cyclones.",
      href: "/tropical-cyclone",
      icon: Tornado,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-4xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">
            Welcome to NiMet-SADIS
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Automated SADIS FTP file ingestion and local transfer. Use the sidebar or the cards below to navigate.
          </p>
        </div>
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-4xl space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Data Products</CardTitle>
            <CardDescription>
              Select a data product to view real-time information and fetched files.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {dataProducts.map((product) => (
              <Card key={product.title} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <product.icon className="mr-3 h-6 w-6 text-primary" />
                    {product.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button asChild className="w-full">
                    <Link href={product.href}>View Data</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>
      </main>
      <footer className="w-full max-w-4xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Dashboard.</p>
      </footer>
    </div>
  );
}
