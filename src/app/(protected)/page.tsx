
"use client";

import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { getAppStatusAndLogs, getLatestFiles } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import type { AppConfig, SessionPayload, LatestFileEntry } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Cloud, AlertTriangle, MountainSnow, Tornado, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";


export default function HomePage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [latestFiles, setLatestFiles] = useState<LatestFileEntry[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setIsFilesLoading(true);
      try {
        const [statusResponse, sessionData, filesResponse] = await Promise.all([
          getAppStatusAndLogs(),
          getSession(),
          getLatestFiles()
        ]);
        if (statusResponse.config) {
          setConfig(statusResponse.config);
        }
        setSession(sessionData);

        if (filesResponse.success && filesResponse.files) {
            setLatestFiles(filesResponse.files);
        }

      } catch (error) {
        console.error("Failed to fetch initial data for homepage:", error);
      } finally {
        setIsLoading(false);
        setIsFilesLoading(false);
      }
    }
    fetchData();
  }, []);

  const dataProducts = [
    {
      title: "OPMET",
      href: "/opmet",
      icon: Cloud,
    },
    {
      title: "SIGMET",
      href: "/sigmet",
      icon: AlertTriangle,
    },
    {
      title: "Volcanic Ash",
      href: "/volcanic-ash",
      icon: MountainSnow,
    },
    {
      title: "Tropical Cyclone",
      href: "/tropical-cyclone",
      icon: Tornado,
    },
  ];

  const getProductDisplayName = (productKey: string) => {
    switch (productKey) {
        case 'opmet': return 'OPMET';
        case 'sigmet': return 'SIGMET';
        case 'volcanicAsh': return 'Volcanic Ash';
        case 'tropicalCyclone': return 'Tropical Cyclone';
        default: return productKey;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-6xl flex items-center justify-between">
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

      <main className="w-full max-w-6xl space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Data Products</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
             {dataProducts.map((product) => (
              <Card key={product.title} className="flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <product.icon className="mr-3 h-6 w-6 text-primary" />
                    {product.title}
                  </CardTitle>
                </CardHeader>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={product.href}>View Data</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Latest Files</CardTitle>
                <CardDescription>
                    A list of the 10 most recently updated files across all products.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isFilesLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : latestFiles.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>File Name</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Last Modified</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {latestFiles.map((file, index) => (
                                <TableRow key={`${file.relativePath}-${index}`}>
                                    <TableCell className="font-medium">{file.name}</TableCell>
                                    <TableCell>{getProductDisplayName(file.product)}</TableCell>
                                    <TableCell>{format(new Date(file.lastModified), "PPp")}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-center text-muted-foreground py-10">No files found in configured directories.</p>
                )}
            </CardContent>
        </Card>

      </main>
      <footer className="w-full max-w-6xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Dashboard.</p>
      </footer>
    </div>
  );
}
