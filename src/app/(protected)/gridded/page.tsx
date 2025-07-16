"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { FetchedFilesList } from "@/components/fetched-files-list";
import type { DirectoryContent } from "@/types";
import { getProductDirectoryListing } from "@/lib/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Network, RefreshCw, Home, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";


const PRODUCT_KEY = "gridded";
const PRODUCT_NAME = "GRIDDED Data";

export default function GriddedPage() {

  const [directoryContent, setDirectoryContent] = useState<DirectoryContent | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();
  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const currentPath = pathSegments.join('/');

  const fetchFiles = useCallback(() => {
    startLoadingTransition(async () => {
      const response = await getProductDirectoryListing(PRODUCT_KEY, currentPath);
      if (response.success && response.content) {
        setDirectoryContent(response.content);
      } else {
        setDirectoryContent({ files: [], folders: [] });
        toast({
          title: "Error Loading Files",
          description: response.error || "Could not list directory contents.",
          variant: "destructive",
        });
      }
    });
  }, [currentPath, toast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFolderClick = (folderName: string) => {
    setPathSegments(prev => [...prev, folderName]);
  };

  const handleBackClick = () => {
    setPathSegments(prev => prev.slice(0, -1));
  };
  
  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      router.push("/");
    } else {
      setPathSegments(prev => prev.slice(0, index + 1));
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start p-4 md:p-8 bg-background">
      <div className="w-full max-w-5xl min-w-[80%] mx-auto space-y-8">
        <header className="w-full flex items-center justify-between">
          <div className="text-center md:text-left">
              <h1 className="text-4xl font-bold text-primary tracking-tight flex items-center">
               <Network className="mr-4 h-10 w-10"/> {PRODUCT_NAME}
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Browse the {PRODUCT_NAME} directory.
              </p>
          </div>
          <div className="flex items-center gap-2">
              <Button onClick={fetchFiles} variant="outline" size="sm" disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
              </Button>
              <div className="md:hidden">
                  <SidebarTrigger />
              </div>
          </div>
        </header>
        <main className="w-full space-y-4">
          <div className="flex items-center mb-2">
            <button onClick={() => handleBreadcrumbClick(-1)} className="hover:text-primary p-2 rounded-md transition-colors">
              <Home className="h-7 w-7"/>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pathSegments.length > 0 && (
              <Card className="w-full">
                <CardContent className="p-0">
                  <div className="flex items-center text-base font-medium text-muted-foreground bg-muted/50 p-4 rounded-lg flex-grow">
                    <Button variant="outline" size="sm" onClick={handleBackClick} disabled={isLoading} className="mr-4">
                      <ArrowLeft className="mr-2 h-5 w-5" /> Back
                    </Button>
                    {pathSegments.map((segment, index) => (
                      <div key={index} className="flex items-center">
                        {index > 0 && <ChevronRight className="h-5 w-5 mx-2 shrink-0" />}
                        <button onClick={() => handleBreadcrumbClick(index)} className="hover:text-primary p-2 rounded-md transition-colors text-left truncate text-lg">
                          {segment}
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/4" />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                   <Skeleton className="h-8 w-1/4 mt-8" />
                   <Skeleton className="h-10 w-full" />
                   <Skeleton className="h-10 w-full" />
                   <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <FetchedFilesList 
                content={directoryContent} 
                onFolderClick={handleFolderClick}
                productKey={PRODUCT_KEY}
                currentPath={currentPath}
            />
          )}
        </main>
      </div>
    </div>
  );
} 