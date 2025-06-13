
"use client";

import type { LocalDirectoryListing, LocalFileEntry, DownloadLocalFileResponse } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, Folder, FolderOpen, Clock, HardDriveDownload, Download, Loader2, ArrowLeft } from "lucide-react";
import { format } from 'date-fns';
import React, { useState } from "react";
import { downloadLocalFile } from "@/lib/actions"; 
import { useToast } from "@/hooks/use-toast";


interface FetchedFilesListProps {
  directoryListing: LocalDirectoryListing | null;
  isLoading: boolean;
  selectedFolderName: string | null;
  onSelectFolder: (folderName: string | null) => void;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function FetchedFilesList({ directoryListing, isLoading, selectedFolderName, onSelectFolder }: FetchedFilesListProps) {
  const { toast } = useToast();
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null); 

  const handleFileDownload = async (folderName: string, file: LocalFileEntry) => {
    const fileIdentifier = `${folderName}_${file.name}`;
    setDownloadingFile(fileIdentifier);
    try {
      const result: DownloadLocalFileResponse = await downloadLocalFile(folderName, file.name);
      if (result.success && result.data && result.contentType && result.fileName) {
        
        let byteArray: Uint8Array;
        // Handle how Next.js serializes Buffer from server actions
        if (typeof result.data === 'object' && (result.data as any).type === 'Buffer' && Array.isArray((result.data as any).data)) {
          byteArray = new Uint8Array((result.data as any).data);
        } else if (Array.isArray(result.data)) { 
          // If it's somehow already an array of numbers (less common for server action Buffer)
          byteArray = Uint8Array.from(result.data);
        } else {
          // Fallback or error if the format is unexpected
          console.error("Unexpected file data format received from server:", result.data);
          toast({ title: "Download Failed", description: "Received invalid file data format.", variant: "destructive" });
          return; // Exit early, finally will still run
        }

        if (byteArray.length === 0 && file.size > 0) {
          toast({ title: "Download Failed", description: "File data is empty or could not be processed after conversion.", variant: "destructive" });
          return; // Exit early, finally will still run
        }
        
        const blob = new Blob([byteArray], { type: result.contentType });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast({ title: "Download Started", description: `${result.fileName} is downloading.` });
      } else {
        toast({ title: "Download Failed", description: result.error || "Unknown error occurred.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Download error:", error);
      toast({ title: "Download Error", description: error.message || "Could not initiate download.", variant: "destructive" });
    } finally {
      setDownloadingFile(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <HardDriveDownload className="mr-2 h-6 w-6 text-primary" />
            Locally Stored Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Loading local files...</p>
        </CardContent>
      </Card>
    );
  }

  if (!directoryListing || Object.keys(directoryListing).length === 0) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <HardDriveDownload className="mr-2 h-6 w-6 text-primary" />
            Locally Stored Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">No folders configured or local directory is not yet populated.</p>
        </CardContent>
      </Card>
    );
  }

  if (selectedFolderName && directoryListing[selectedFolderName]) {
    const files = directoryListing[selectedFolderName];
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-2xl">
              <FolderOpen className="mr-2 h-6 w-6 text-primary" />
              Files in: {selectedFolderName}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => onSelectFolder(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Folders
            </Button>
          </div>
          <CardDescription>
            List of files within the selected folder. Click to download.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">This folder is empty.</p>
          ) : (
            <ScrollArea className="h-96 w-full rounded-md border bg-muted/10 p-1">
              <ul className="space-y-1 p-2">
                {files.map((file) => {
                  const fileIdentifier = `${selectedFolderName}_${file.name}`;
                  const isDownloadingThisFile = downloadingFile === fileIdentifier;
                  return (
                    <li key={file.name} className="p-2 rounded-md hover:bg-background/70 transition-colors border-b last:border-b-0">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-foreground/70 shrink-0" />
                        <span className="text-sm text-foreground/90 font-medium break-all flex-grow">{file.name}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleFileDownload(selectedFolderName, file)}
                          disabled={isDownloadingThisFile}
                          aria-label={`Download ${file.name}`}
                        >
                          {isDownloadingThisFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-primary/90" />}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 pl-1">
                        <span>{formatBytes(file.size)}</span>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(file.lastModified), "MMM d, HH:mm")}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default view: Grid of folders
  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <HardDriveDownload className="mr-2 h-6 w-6 text-primary" />
          Locally Stored Folders
        </CardTitle>
        <CardDescription>
          Click on a folder to view its files.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(directoryListing).map(([folderName, files]) => (
            <Card 
              key={folderName} 
              className="flex flex-col cursor-pointer hover:shadow-xl transition-shadow duration-200"
              onClick={() => onSelectFolder(folderName)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectFolder(folderName);}}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-xl">
                  <Folder className="h-5 w-5 text-primary/80 mr-2" />
                  {folderName}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  {files.length} file{files.length === 1 ? '' : 's'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
