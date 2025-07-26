'use client';

import { useState, useEffect, Suspense } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { getAppStatusAndLogs, getLatestFiles, downloadLocalFile } from "@/lib/actions";
import type { AppConfig, SessionPayload, LatestFileEntry } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Cloud, AlertTriangle, MountainSnow, Tornado, Loader2, Download, Eye, Network, FileText, Settings, Mountain } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useSearchParams } from 'next/navigation';

function HomePageContent() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [latestFiles, setLatestFiles] = useState<LatestFileEntry[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState(true);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<LatestFileEntry | null>(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const searchParams = useSearchParams();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setIsFilesLoading(true);
      try {
        // Check for SSO redirect
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          if (searchParams.get('sso') === '1') {
            // Ensure session token is set in localStorage
            // Removed getSessionClient()
            // Remove sso param from URL (optional, for cleanliness)
            url.searchParams.delete('sso');
            window.history.replaceState({}, '', url.pathname + url.search);
          }
        }
        const [statusResponse, filesResponse] = await Promise.all([
          getAppStatusAndLogs(),
          getLatestFiles(currentPage, pageSize)
        ]);
        if (statusResponse.config) {
          setConfig(statusResponse.config);
        }
        // Removed setSession(sessionData);

        if (filesResponse.success && filesResponse.files) {
            setLatestFiles(filesResponse.files);
            setTotalCount(filesResponse.totalCount || 0);
        }

      } catch (error) {
        console.error("Failed to fetch initial data for homepage:", error);
      } finally {
        setIsLoading(false);
        setIsFilesLoading(false);
      }
    }
    fetchData();
  }, [currentPage, searchParams]); // Added searchParams dependency

  const dataProducts = [
    {
      title: "GRIDDED",
      href: "/gridded",
      icon: Network,
    },
    {
      title: "OPMET",
      href: "/opmet",
      icon: Cloud,
    },
    {
      title: "SIGWX",
      href: "/sigwx",
      icon: AlertTriangle,
    },
    {
      title: "VAA",
      href: "/vaa",
      icon: Mountain,
    },
  ];

  const getProductDisplayName = (productKey: string) => {
    switch (productKey) {
        case 'opmet': return 'OPMET';
        case 'sigmet': return 'SIGMET';
        case 'volcanicAsh': return 'Volcanic Ash';
        case 'tropicalCyclone': return 'Tropical Cyclone';
        case 'vaa': return 'VAA'; // Added VAA case
        default: return productKey;
    }
  };

  const isImageFile = (fileName: string) => {
    return /.(jpe?g|png|gif|webp)$/i.test(fileName);
  };

  const handleFileView = async (file: LatestFileEntry) => {
    setIsLoadingPreview(true);
    setPreviewImageName(file.name);
    setPreviewFile(file);
    setIsPreviewOpen(true);

    try {
      const result = await downloadLocalFile(file.product, file.relativePath);
      if (result.success && result.data && result.contentType) {
        let byteArray;
        if (typeof result.data === 'object' && (result.data as any).type === 'Buffer' && Array.isArray((result.data as any).data)) {
          byteArray = new Uint8Array((result.data as any).data);
        } else if (Array.isArray(result.data)) { 
          byteArray = Uint8Array.from(result.data);
        } else {
          throw new Error("Invalid file data format received");
        }
        const blob = new Blob([byteArray], { type: result.contentType });
        const imageUrl = URL.createObjectURL(blob);
        setPreviewImageUrl(imageUrl);
      } else {
        toast({ title: "Preview Failed", description: result.error || "Could not load image.", variant: "destructive" });
        setIsPreviewOpen(false);
      }
    } catch (error: any) {
      toast({ title: "Preview Error", description: error.message || "An error occurred.", variant: "destructive" });
      setIsPreviewOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleFileDownload = async (file: LatestFileEntry) => {
    setDownloadingFile(file.relativePath);
    try {
      const result = await downloadLocalFile(file.product, file.relativePath);
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
      toast({ title: "Download Error", description: error.message || "Could not initiate download." });
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setIsPreviewOpen(open);
    if (!open) {
      setPreviewImageUrl(null);
      setPreviewImageName("");
      setPreviewFile(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-6xl flex items-center justify-between">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
      </header>

      <main className="w-full flex justify-center">
        <div className="w-full max-w-5xl min-w-[80%] mx-auto space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Available Products</CardTitle>
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
                      A list of the recently updated files across all products.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  {isFilesLoading ? (
                      <div className="flex justify-center items-center h-48">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                  ) : latestFiles.length > 0 ? (
                      <>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>File Name</TableHead>
                                  <TableHead>Product</TableHead>
                                  <TableHead>Last Modified</TableHead>
                                  <TableHead>Actions</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {latestFiles.map((file, index) => (
                                  <TableRow key={`${file.relativePath}-${index}`}>
                                      <TableCell className="font-medium">{file.name}</TableCell>
                                      <TableCell>{getProductDisplayName(file.product)}</TableCell>
                                      <TableCell>{format(new Date(file.lastModified), "PPp")}</TableCell>
                                      <TableCell>
                                          <div className="flex items-center space-x-2">
                                              <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => handleFileDownload(file)}
                                                  disabled={downloadingFile === file.relativePath}
                                                  className="h-8 px-2"
                                              >
                                                  {downloadingFile === file.relativePath ? (
                                                      <Loader2 className="h-4 w-4 animate-spin" />
                                                  ) : (
                                                      <Download className="h-4 w-4" />
                                                  )}
                                              </Button>
                                              {isImageFile(file.name) && (
                                                  <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => handleFileView(file)}
                                                      disabled={isLoadingPreview}
                                                      className="h-8 px-2"
                                                  >
                                                      <Eye className="h-4 w-4" />
                                                  </Button>
                                              )}
                                          </div>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                      {/* Pagination Controls */}
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-sm text-muted-foreground">
                          Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} files
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => p + 1)}
                            disabled={currentPage * pageSize >= totalCount}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                      </>
                  ) : (
                      <p className="text-center text-muted-foreground py-10">No files found in configured directories.</p>
                  )}
              </CardContent>
          </Card>
        </div>
      </main>
      <footer className="w-full text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Dashboard.</p>
      </footer>

      <Dialog open={isPreviewOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="w-[95vw] h-[95vh] max-w-none max-h-none">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewImageName}</span>
              {previewFile && (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(previewFile.lastModified), "PPp")}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center w-full h-full overflow-hidden">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : previewImageUrl ? (
              <img 
                src={previewImageUrl} 
                alt={previewImageName} 
                className="max-w-full max-h-full object-contain"
                onLoad={() => URL.revokeObjectURL(previewImageUrl)}
              />
            ) : (
              <p className="text-muted-foreground">Failed to load image</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => previewFile && handleFileDownload(previewFile)}
              disabled={downloadingFile === previewFile?.relativePath}
            >
              {downloadingFile === previewFile?.relativePath ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageContent />
    </Suspense>
  );
}