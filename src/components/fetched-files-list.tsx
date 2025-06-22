
"use client";

import type { DirectoryContent, LocalFileEntry } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, Folder, Clock, Download, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import React, { useState } from "react";
import { downloadLocalFile } from "@/lib/actions"; 
import { useToast } from "@/hooks/use-toast";

interface FetchedFilesListProps {
  content: DirectoryContent | null;
  onFolderClick: (folderName: string) => void;
  productKey: string;
  currentPath: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function FetchedFilesList({ content, onFolderClick, productKey, currentPath }: FetchedFilesListProps) {
  const { toast } = useToast();
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null); 

  const handleFileDownload = async (file: LocalFileEntry) => {
    const fullFilePath = [currentPath, file.name].filter(Boolean).join('/');
    setDownloadingFile(fullFilePath);
    try {
      const result = await downloadLocalFile(productKey, fullFilePath);
      if (result.success && result.data && result.contentType && result.fileName) {
        
        let byteArray: Uint8Array;
        if (typeof result.data === 'object' && (result.data as any).type === 'Buffer' && Array.isArray((result.data as any).data)) {
          byteArray = new Uint8Array((result.data as any).data);
        } else if (Array.isArray(result.data)) { 
          byteArray = Uint8Array.from(result.data);
        } else {
          console.error("Unexpected file data format received from server:", result.data);
          toast({ title: "Download Failed", description: "Received invalid file data format.", variant: "destructive" });
          setDownloadingFile(null);
          return;
        }

        if (byteArray.length === 0 && file.size > 0) {
          toast({ title: "Download Failed", description: "File data is empty or could not be processed after conversion.", variant: "destructive" });
          setDownloadingFile(null);
          return;
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

  const noContent = !content || (content.files.length === 0 && content.folders.length === 0);

  return (
    <Card className="w-full shadow-lg">
      <CardContent className="p-6">
        {noContent ? (
          <p className="text-muted-foreground text-center py-8">This directory is empty.</p>
        ) : (
          <div className="space-y-8">
            {content.folders.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2">Folders</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {content.folders.map((folderName) => (
                    <Card 
                      key={folderName} 
                      className="flex flex-col cursor-pointer hover:shadow-xl hover:border-primary/50 transition-all duration-200 group"
                      onClick={() => onFolderClick(folderName)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onFolderClick(folderName);}}
                    >
                      <CardHeader className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                        <Folder className="h-10 w-10 text-primary/70 mb-2 transition-colors group-hover:text-primary" />
                        <p className="text-sm font-medium text-foreground break-all">{folderName}</p>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {content.files.length > 0 && (
              <div>
                 <h3 className="text-lg font-semibold mb-4 border-b pb-2">Files</h3>
                 <ScrollArea className="h-96 w-full rounded-md border p-1 bg-muted/20">
                  <ul className="space-y-1 p-2">
                    {content.files.map((file) => {
                      const fullFilePath = [currentPath, file.name].filter(Boolean).join('/');
                      const isDownloadingThisFile = downloadingFile === fullFilePath;
                      return (
                        <li key={file.name} className="p-2 rounded-md hover:bg-background transition-colors border-b last:border-b-0">
                          <div className="flex items-center space-x-3">
                            <FileText className="h-5 w-5 text-foreground/70 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground/90 font-medium break-words">{file.name}</p>
                                <div className="flex items-center justify-start text-xs text-muted-foreground mt-1 space-x-4">
                                    <span>{formatBytes(file.size)}</span>
                                    <div className="flex items-center space-x-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{format(new Date(file.lastModified), "PPp")}</span>
                                    </div>
                                </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 shrink-0"
                              onClick={() => handleFileDownload(file)}
                              disabled={isDownloadingThisFile}
                              aria-label={`Download ${file.name}`}
                            >
                              {isDownloadingThisFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-primary/90" />}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                 </ScrollArea>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
