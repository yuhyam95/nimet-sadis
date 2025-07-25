"use client";

import type { DirectoryContent, LocalFileEntry } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, Folder, Clock, Download, Loader2, Eye, Search, X } from "lucide-react";
import { format } from 'date-fns';
import React, { useState, useEffect } from "react";
import { downloadLocalFile } from "@/lib/actions"; 
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader as DialogHeaderPrimitive,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

const isImageFile = (fileName: string) => {
    return /\.(jpe?g|png|gif|webp)$/i.test(fileName);
};

const isTextFile = (fileName: string) => {
    return /\.txt$/i.test(fileName);
};


export function FetchedFilesList({ content, onFolderClick, productKey, currentPath }: FetchedFilesListProps) {
  const { toast } = useToast();
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null); 
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState<LocalFileEntry | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState<string>("");

  useEffect(() => {
    // Cleanup blob URL on unmount
    return () => {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

  const handleDialogChange = (isOpen: boolean) => {
      if (!isOpen) {
          if (previewImageUrl) {
              URL.revokeObjectURL(previewImageUrl);
          }
          setPreviewImageUrl(null);
          setPreviewImageName(null);
          setPreviewFile(null);
          setPreviewText(null);
          setFilterType("ALL");
          setSearchTerms([]);
          setSearchInput("");
      }
      setIsPreviewOpen(isOpen);
  }

  // Filter text content based on type and search term
  const getFilteredText = () => {
    if (!previewText) return "";
    
    let filteredText = previewText;
    let reports: string[] = [];
    
    // Filter by type
    if (filterType === "TAF") {
      const lines = previewText.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // More precise TAF detection - must start with TAF and contain typical TAF elements
        if (line.trim().startsWith('TAF') && line.includes('Z')) {
          let tafReport = line;
          let j = i + 1;
          
          // If the current line already ends with '=', this is a single-line TAF
          if (line.includes('=')) {
            reports.push(tafReport);
            continue; // Move to next line
          }
          
          // Continue reading lines until we find the '=' sign
          while (j < lines.length && !lines[j].includes('=')) {
            tafReport += '\n' + lines[j];
            j++;
          }
          
          // Include the line with '=' if found
          if (j < lines.length && lines[j].includes('=')) {
            tafReport += '\n' + lines[j];
          }
          
          reports.push(tafReport);
          i = j; // Skip the lines we've already processed
        }
      }
    } else if (filterType === "METAR") {
      const lines = previewText.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // More precise METAR detection - must start with METAR and contain typical METAR elements
        if (line.trim().startsWith('METAR') && line.includes('Z')) {
          let metarReport = line;
          let j = i + 1;
          
          // If the current line already ends with '=', this is a single-line METAR
          if (line.includes('=')) {
            reports.push(metarReport);
            continue; // Move to next line
          }
          
          // Continue reading lines until we find the '=' sign
          while (j < lines.length && !lines[j].includes('=')) {
            metarReport += '\n' + lines[j];
            j++;
          }
          
          // Include the line with '=' if found
          if (j < lines.length && lines[j].includes('=')) {
            metarReport += '\n' + lines[j];
          }
          
          reports.push(metarReport);
          i = j; // Skip the lines we've already processed
        }
      }
    } else {
      // ALL filter - split by lines for search
      reports = previewText.split('\n');
    }
    
    // Filter by search terms - apply to complete reports, not individual lines
    if (searchTerms.length > 0) {
      reports = reports.filter(report => 
        searchTerms.some(term => 
          report.toLowerCase().includes(term.toLowerCase())
        )
      );
    }
    
    return reports.join('\n\n');
  };

  const handleFileView = async (file: LocalFileEntry) => {
    const fullFilePath = [currentPath, file.name].filter(Boolean).join('/');
    setIsLoadingPreview(true);
    setPreviewImageName(file.name);
    setPreviewFile(file);
    handleDialogChange(true);

    try {
        const result = await downloadLocalFile(productKey, fullFilePath);
        if (result.success && result.data && result.contentType) {
            let byteArray;
            if (typeof result.data === 'object' && (result.data as any).type === 'Buffer' && Array.isArray((result.data as any).data)) {
                byteArray = new Uint8Array((result.data as any).data);
            } else if (Array.isArray(result.data)) { 
                byteArray = Uint8Array.from(result.data);
            } else {
                throw new Error("Invalid file data format received");
            }
            if (isImageFile(file.name)) {
                const blob = new Blob([byteArray], { type: result.contentType });
                const imageUrl = URL.createObjectURL(blob);
                setPreviewImageUrl(imageUrl);
                setPreviewText(null);
            } else if (isTextFile(file.name)) {
                // Only preview first 100KB
                const maxBytes = 100 * 1024;
                const text = new TextDecoder('utf-8').decode(byteArray.slice(0, maxBytes));
                setPreviewText(text);
                setPreviewImageUrl(null);
            } else {
                toast({ title: "Preview Not Supported", description: "Preview is only available for images and .txt files.", variant: "destructive" });
                handleDialogChange(false);
            }
        } else {
            toast({ title: "Preview Failed", description: result.error || "Could not load file.", variant: "destructive" });
            handleDialogChange(false);
        }
    } catch (error: any) {
        toast({ title: "Preview Error", description: error.message || "An error occurred.", variant: "destructive" });
        handleDialogChange(false);
    } finally {
        setIsLoadingPreview(false);
    }
  };

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
    <>
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
                              <div className="flex items-center shrink-0">
                                {(isImageFile(file.name) || isTextFile(file.name)) && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleFileView(file)}
                                        disabled={isDownloadingThisFile || isLoadingPreview && previewImageName === file.name}
                                        aria-label={`View ${file.name}`}
                                    >
                                        <Eye className="h-4 w-4 text-primary/90" />
                                    </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleFileDownload(file)}
                                  disabled={isDownloadingThisFile}
                                  aria-label={`Download ${file.name}`}
                                >
                                  {isDownloadingThisFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-primary/90" />}
                                </Button>
                              </div>
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
      <Dialog open={isPreviewOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="w-[95vw] h-[95vh] max-w-none max-h-none">
          <DialogHeaderPrimitive>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewImageName || 'File Preview'}</span>
              {previewFile && (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(previewFile.lastModified), "PPp")}
                </span>
              )}
            </DialogTitle>
          </DialogHeaderPrimitive>
          
          {/* Filter controls for .txt files */}
          {previewText && (
            <div className="flex items-center gap-4 p-4 border-b">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  <SelectItem value="TAF">TAF</SelectItem>
                  <SelectItem value="METAR">METAR</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1 max-w-md space-y-2">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type keyword and press Enter..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchInput.trim()) {
                        e.preventDefault();
                        const newTerm = searchInput.trim();
                        if (!searchTerms.includes(newTerm)) {
                          setSearchTerms([...searchTerms, newTerm]);
                        }
                        setSearchInput("");
                      }
                    }}
                    className="pl-10"
                  />
                </div>
                
                {/* Search terms display */}
                {searchTerms.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {searchTerms.map((term, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {term}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => setSearchTerms(searchTerms.filter((_, i) => i !== index))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-center items-center w-full h-full overflow-hidden">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : previewImageUrl ? (
              <img 
                src={previewImageUrl} 
                alt={previewImageName || 'Preview'} 
                className="max-w-full max-h-full object-contain"
                onLoad={() => URL.revokeObjectURL(previewImageUrl)}
              />
            ) : previewText ? (
              <pre className="w-full max-h-[60vh] overflow-auto bg-muted/40 p-4 rounded text-sm text-left whitespace-pre-wrap break-words">
                {getFilteredText()}
              </pre>
            ) : (
              <p className="text-muted-foreground">Failed to load preview</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => previewFile && handleFileDownload(previewFile)}
              disabled={downloadingFile === (previewFile ? [currentPath, previewFile.name].filter(Boolean).join('/') : null)}
            >
              {downloadingFile === (previewFile ? [currentPath, previewFile.name].filter(Boolean).join('/') : null) ? (
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
    </>
  );
}
