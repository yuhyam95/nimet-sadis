
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { AppConfig, MonitoredFolderConfig, FetchFtpFolderResponse as ServerFetchResponse, LocalDirectoryListing, LocalDirectoryResponse } from "@/types";
import { getAppStatusAndLogs, fetchAndProcessFtpFolder, getLocalDirectoryListing } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Cloud } from "lucide-react";

type ClientFetchFtpFolderResponse = ServerFetchResponse;

export default function OpmetPage() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [isGloballyMonitoring, setIsGloballyMonitoring] = useState<boolean>(false);
  const [localFilesListing, setLocalFilesListing] = useState<LocalDirectoryListing | null>(null);
  const [isLoadingLocalFiles, setIsLoadingLocalFiles] = useState(true);
  const [selectedFolderNameForView, setSelectedFolderNameForView] = useState<string | null>(null);

  const handleSelectFolderForView = useCallback((folderName: string | null) => {
    setSelectedFolderNameForView(folderName);
  }, []);

  useEffect(() => {
    async function fetchInitialStatusConfigAndLocalFiles() {
      setIsLoadingLocalFiles(true);

      try {
        const { status: serverOverallStatus, config: serverConfig } = await getAppStatusAndLogs();
        
        if (serverConfig) {
          setAppConfig(serverConfig);
          setIsGloballyMonitoring(serverOverallStatus === 'monitoring');

          if (serverConfig.server.localPath) {
            try {
              const response: LocalDirectoryResponse = await getLocalDirectoryListing();
              if (response.success && response.listing) {
                setLocalFilesListing(response.listing);
              } else {
                setLocalFilesListing({}); 
              }
            } catch (localError) {
              setLocalFilesListing({});
            }
          } else {
            setLocalFilesListing({});
          }
        } else {
          setAppConfig(null);
          setIsGloballyMonitoring(false);
          setLocalFilesListing({});
        }
      } catch (error) {
        console.error("Failed to fetch initial app status for OPMET Page:", error);
        setIsGloballyMonitoring(false);
        setAppConfig(null);
        setLocalFilesListing({});
      } finally {
        setIsLoadingLocalFiles(false);
      }
    }
    fetchInitialStatusConfigAndLocalFiles();
  }, []); 

  useEffect(() => {
    const activeIntervals: NodeJS.Timeout[] = [];
  
    if (isGloballyMonitoring && appConfig && appConfig.server && appConfig.folders && appConfig.folders.length > 0) {
      appConfig.folders.forEach((folder: MonitoredFolderConfig) => {
        const pollFolder = async () => {
          if (!isGloballyMonitoring || !appConfig || !appConfig.server) return;

          try {
            const result: ClientFetchFtpFolderResponse = await fetchAndProcessFtpFolder(appConfig.server, folder);
            
            if (result.success) {
              if (!selectedFolderNameForView) {
                try {
                    const response: LocalDirectoryResponse = await getLocalDirectoryListing();
                    if (response.success && response.listing) {
                        setLocalFilesListing(response.listing);
                    }
                } catch (e) {
                    console.warn("Could not auto-refresh local files after FTP op:", e);
                }
              }
            }
          } catch (e: any) {
            // Error is logged in server action
          }
        };

        pollFolder(); 
        const intervalId = setInterval(pollFolder, (folder.interval || 5) * 60 * 1000); 
        activeIntervals.push(intervalId);
      });

    }
  
    return () => {
      activeIntervals.forEach(clearInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGloballyMonitoring, appConfig, selectedFolderNameForView]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-primary tracking-tight flex items-center">
             <Cloud className="mr-4 h-10 w-10"/> OPMET Data
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Monitor OPMET data ingestion and view locally stored files.
            </p>
        </div>
        <div className="flex items-center gap-2">
            <div className="md:hidden">
                <SidebarTrigger />
            </div>
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <FetchedFilesList 
            directoryListing={localFilesListing} 
            isLoading={isLoadingLocalFiles}
            selectedFolderName={selectedFolderNameForView}
            onSelectFolder={handleSelectFolderForView}
        />
      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. OPMET Data.</p>
      </footer>
    </div>
  );
}
