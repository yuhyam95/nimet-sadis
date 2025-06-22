
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { LocalDirectoryListing, LocalDirectoryResponse } from "@/types";
import { getLocalDirectoryListing } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tornado, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TropicalCyclonePage() {
  const [localFilesListing, setLocalFilesListing] = useState<LocalDirectoryListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFolderNameForView, setSelectedFolderNameForView] = useState<string | null>(null);

  const handleSelectFolderForView = useCallback((folderName: string | null) => {
    setSelectedFolderNameForView(folderName);
  }, []);

  const fetchLocalFiles = useCallback(async () => {
    setIsLoading(true);
    try {
        const response: LocalDirectoryResponse = await getLocalDirectoryListing();
        if (response.success && response.listing) {
          setLocalFilesListing(response.listing);
        } else {
          setLocalFilesListing({}); 
        }
    } catch (error) {
        console.error("Failed to fetch Tropical Cyclone page file listing:", error);
        setLocalFilesListing({});
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocalFiles();
  }, [fetchLocalFiles]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight flex items-center">
            <Tornado className="mr-4 h-10 w-10"/> Tropical Cyclone Data
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            View locally stored files for tropical cyclone advisories.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={fetchLocalFiles} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Files
            </Button>
            <div className="md:hidden">
                <SidebarTrigger />
            </div>
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <FetchedFilesList 
            directoryListing={localFilesListing} 
            isLoading={isLoading}
            selectedFolderName={selectedFolderNameForView}
            onSelectFolder={handleSelectFolderForView}
            title="Tropical Cyclone Products"
        />
      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Tropical Cyclone Data.</p>
      </footer>
    </div>
  );
}
