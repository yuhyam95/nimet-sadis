
"use client";

import type { LocalDirectoryListing, LocalFileEntry, DownloadLocalFileResponse } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, FolderArchive, Clock, HardDriveDownload, AlertCircle, Download, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import React, { useState } from "react";
import { downloadLocalFile } from "@/lib/actions"; 
import { useToast } from "@/hooks/use-toast";


interface FetchedFilesListProps {
  directoryListing: LocalDirectoryListing | null;
  isLoading: boolean;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function FetchedFilesList({ directoryListing, isLoading }: FetchedFilesListProps) {
  const { toast } = useToast();
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null); 

  const handleFileDownload = async (folderName: string, file: LocalFileEntry) => {
    const fileIdentifier = `${folderName}_${file.name}`;
    setDownloadingFile(fileIdentifier);
    try {
      const result: DownloadLocalFileResponse = await downloadLocalFile(folderName, file.name);
      if (result.success && result.data && result.contentType && result.fileName) {
        const byteArray = new Uint8Array(result.data);
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
      toast({ title: "Download Error", description: error.message || "Could not initiate download.", variant: "destructive" });
    } finally {
      setDownloadingFile(null);
    }
  };

  // const hasContent = directoryListing && Object.keys(directoryListing).length > 0 && Object.values(directoryListing).some(files => files.length > 0);

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <HardDriveDownload className="mr-2 h-6 w-6 text-primary" />
          Locally Stored Files
        </CardTitle>
        <CardDescription>
          Files downloaded from FTP and stored in your local directory, organized by folder. Click to download.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-4">Loading local files...</p>
        ) : !directoryListing || Object.keys(directoryListing).length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No folders configured or local directory is not yet populated.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(directoryListing).map(([folderName, files]) => (
              <Card key={folderName} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-xl">
                    <FolderArchive className="h-5 w-5 text-primary/80 mr-2" />
                    {folderName}
                    <span className="ml-auto text-sm font-normal text-muted-foreground">({files.length} file{files.length === 1 ? '' : 's'})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  {files.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">This folder is empty.</p>
                  ) : (
                    <ScrollArea className="h-72 w-full rounded-md border bg-muted/10 p-1">
                      <ul className="space-y-1 p-2">
                        {files.map((file) => {
                          const fileIdentifier = `${folderName}_${file.name}`;
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
                                  onClick={() => handleFileDownload(folderName, file)}
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
                                </div> {/* Closes div with Clock */}
                              </div> {/* Closes div with formatBytes and Clock div */}
                            </li> // Closes li
                          );
                        })} {/* Closes files.map */}
                      </ul> {/* Closes ul */}
                    </ScrollArea> // Closes ScrollArea
                  )} {/* Closes conditional for files.length === 0 */}
                </CardContent> {/* Closes CardContent for the folder card */}
              </Card> // Closes Card for the folder
            ))} {/* Closes Object.entries(directoryListing).map */}
          </div> // Closes the grid div
        )} {/* Closes conditional for isLoading / !directoryListing */}
      </CardContent> {/* Closes main CardContent */}
    </Card> // Closes main Card
  ); // Closes return statement
} // Closes function FetchedFilesList

    