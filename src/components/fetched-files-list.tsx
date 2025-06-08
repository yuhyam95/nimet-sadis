
"use client";

import type { LocalDirectoryListing, LocalFileEntry } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, FolderArchive, Clock, HardDriveDownload, AlertCircle } from "lucide-react";
import { format } from 'date-fns';

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
  const hasContent = directoryListing && Object.keys(directoryListing).length > 0 && Object.values(directoryListing).some(files => files.length > 0);

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <HardDriveDownload className="mr-2 h-6 w-6 text-primary" />
          Locally Stored Files
        </CardTitle>
        <CardDescription>
          Files downloaded from FTP and stored in your local directory, organized by folder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-4">Loading local files...</p>
        ) : !directoryListing || Object.keys(directoryListing).length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No folders configured or local directory is empty.</p>
        ) : !hasContent && Object.keys(directoryListing).length > 0 ? (
            <p className="text-muted-foreground text-center py-4">Configured local folders are currently empty.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {Object.entries(directoryListing).map(([folderName, files]) => (
              <AccordionItem value={folderName} key={folderName}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center space-x-2">
                    <FolderArchive className="h-5 w-5 text-primary/80" />
                    <span className="text-lg font-medium text-foreground/90">{folderName}</span>
                    <span className="text-sm text-muted-foreground">({files.length} file{files.length === 1 ? '' : 's'})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {files.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-4 py-2">This folder is empty.</p>
                  ) : (
                    <ScrollArea className="h-60 w-full rounded-md border bg-muted/5 p-1">
                      <ul className="space-y-2 p-2">
                        {files.map((file) => (
                          <li key={file.name} className="flex flex-col p-3 rounded-md hover:bg-background/70 transition-colors border-b last:border-b-0">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-foreground/70 shrink-0" />
                              <span className="text-foreground/90 font-medium break-all">{file.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                            </div>
                            <div className="flex items-center space-x-2 mt-1 pl-1">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">
                                Last Modified: {format(new Date(file.lastModified), "PPpp")}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
         {!isLoading && directoryListing === null && (
            <div className="text-center py-4 text-destructive flex items-center justify-center">
                <AlertCircle className="mr-2 h-5 w-5"/>
                <p>Could not load local directory information. Check server logs.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
