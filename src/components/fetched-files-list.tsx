
"use client";

import type { FetchedFileEntry } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, FolderArchive, Clock } from "lucide-react";

interface FetchedFilesListProps {
  files: FetchedFileEntry[];
}

export function FetchedFilesList({ files }: FetchedFilesListProps) {
  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <FolderArchive className="mr-2 h-6 w-6 text-primary" />
          Fetched Files
        </CardTitle>
        <CardDescription>
          List of files successfully transferred from the FTP server, organized by folder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No files fetched yet.</p>
        ) : (
          <ScrollArea className="h-60 w-full rounded-md border p-3 bg-muted/30">
            <ul className="space-y-3">
              {files.map((entry, index) => (
                <li key={`${entry.folderName}-${entry.fileName}-${index}`} className="flex flex-col p-3 rounded-md hover:bg-background/70 transition-colors border-b last:border-b-0">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-foreground/70 shrink-0" />
                    <span className="text-foreground/90 font-medium break-all">{entry.fileName}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1 pl-1">
                    <FolderArchive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">From: {entry.folderName}</span>
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
                    <span className="text-xs text-muted-foreground">{entry.timestamp.toLocaleTimeString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
