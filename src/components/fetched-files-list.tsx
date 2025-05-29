
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon, FolderArchive } from "lucide-react";

interface FetchedFilesListProps {
  files: string[];
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
          List of files successfully transferred from the FTP server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No files fetched yet.</p>
        ) : (
          <ScrollArea className="h-48 w-full rounded-md border p-3 bg-muted/30">
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li key={index} className="flex items-center space-x-2 p-2 rounded-md hover:bg-background transition-colors text-sm">
                  <FileIcon className="h-4 w-4 text-foreground/70" />
                  <span className="text-foreground/90">{file}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
