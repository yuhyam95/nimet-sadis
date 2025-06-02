
"use client";

import type { Control } from "react-hook-form";
import { useActionState, useEffect, useState, useTransition, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Settings, Play, StopCircle, Loader2, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppConfig, FtpServerDetails, MonitoredFolderConfig, LogEntry } from "@/types";
import { submitConfiguration, toggleMonitoring, type ActionResponse } from "@/lib/actions";
import React from "react";
import { Separator } from "@/components/ui/separator";

const serverDetailsSchema = z.object({
  host: z.string().min(1, { message: "FTP host is required." }),
  port: z.string().refine(val => /^\d+$/.test(val) && parseInt(val, 10) > 0 && parseInt(val, 10) <= 65535, {
    message: "Port must be a number between 1 and 65535.",
  }),
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().optional(),
  localPath: z.string().min(1, { message: "Root local server path is required." }),
});

const monitoredFolderSchema = z.object({
  id: z.string().optional(), // react-hook-form useFieldArray adds its own id, server generates if missing
  name: z.string().min(1, { message: "Folder name is required."}),
  remotePath: z.string().min(1, { message: "FTP remote path is required." }).refine(val => val.startsWith('/'), { message: "Remote path must start with /"}),
  interval: z.string().refine(val => /^\d+$/.test(val) && parseInt(val, 10) >= 1, {
    message: "Interval must be at least 1 minute.",
  }),
});

const formSchema = z.object({
  server: serverDetailsSchema,
  folders: z.array(monitoredFolderSchema).min(1, { message: "At least one monitored folder is required." }),
});

type FormValues = z.infer<typeof formSchema>;

interface FileFetcherFormProps {
  onConfigChange: (config: AppConfig) => void;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  initialConfig?: AppConfig; // Updated to AppConfig
  isCurrentlyMonitoring: boolean;
  setIsCurrentlyMonitoring: (isMonitoring: boolean) => void;
}

export function FileFetcherForm({ 
  onConfigChange, 
  addLog, 
  initialConfig,
  isCurrentlyMonitoring,
  setIsCurrentlyMonitoring 
}: FileFetcherFormProps) {
  const [formSubmitState, formAction] = useActionState<ActionResponse | null, FormData>(submitConfiguration, null);
  
  const [isConfigSubmitting, startConfigSubmitTransition] = useTransition();
  const [isTogglingMonitor, setIsTogglingMonitor] = useState(false); 

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      server: { host: "", port: "21", username: "", password: "", localPath: "ftp_downloads" },
      folders: [{ name: "Default Folder", remotePath: "/upload/", interval: "5" }]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "folders"
  });

  useEffect(() => {
    if (initialConfig) {
      form.reset({
        server: {
          ...initialConfig.server,
          port: initialConfig.server.port.toString(),
        },
        folders: initialConfig.folders.map(folder => ({
          ...folder,
          interval: folder.interval.toString(),
        })),
      });
    } else {
      form.reset({
        server: { host: "", port: "21", username: "", password: "", localPath: "ftp_downloads" },
        folders: [{ name: "Default Folder", remotePath: "/upload/", interval: "5" }]
      });
    }
  }, [initialConfig, form]);

  useEffect(() => {
    if (formSubmitState?.success && formSubmitState.config) {
      onConfigChange(formSubmitState.config); 
      addLog({ message: formSubmitState.message, type: 'success' });
      // setIsCurrentlyMonitoring(true); // Monitoring starts implicitly by applying config
    } else if (formSubmitState && !formSubmitState.success) {
      addLog({ message: formSubmitState.message, type: 'error' });
      if (formSubmitState.errorDetails) {
        // Handle server-side validation errors
        // For simplicity, showing a general error. Detailed field mapping can be complex.
        Object.entries(formSubmitState.errorDetails).forEach(([fieldPath, errors]) => {
          if (typeof errors === 'object' && errors !== null && !Array.isArray(errors)) { // Nested errors for server or folders
            Object.entries(errors).forEach(([subField, subErrors]) => {
              const path = fieldPath.includes('folders') ? `${fieldPath}.${subField}` : `${fieldPath}.${subField}`;
              // @ts-ignore // Allow dynamic path setting
              form.setError(path as any, { message: (subErrors as string[]).join(', ') });
            });
          } else if (Array.isArray(errors)) { // Top-level error or direct field error
            // @ts-ignore
             form.setError(fieldPath as any, { message: errors.join(', ') });
          }
        });
      }
    }
  }, [formSubmitState, onConfigChange, addLog, form, setIsCurrentlyMonitoring]);

  function onSubmit(data: FormValues) {
    const formData = new FormData();
    
    // Append server details
    Object.entries(data.server).forEach(([key, value]) => {
      formData.append(key, value as string);
    });

    // Append folders array as JSON string
    // Ensure each folder has an ID for the server type, client can omit
    const foldersWithIds = data.folders.map(folder => ({
      ...folder,
      id: folder.id || crypto.randomUUID() 
    }));
    formData.append('foldersJson', JSON.stringify(foldersWithIds));
    
    startConfigSubmitTransition(() => {
      formAction(formData);
    });
  }

  const handleToggleMonitoring = useCallback(async () => {
    if (!initialConfig && !form.getValues('server.host')) { 
        addLog({ message: "Cannot toggle monitoring without an active configuration.", type: 'warning' });
        return;
    }
    setIsTogglingMonitor(true);
    try {
      const response = await toggleMonitoring(!isCurrentlyMonitoring); 
      if (response.success) {
          addLog({ message: response.message, type: 'info' });
          setIsCurrentlyMonitoring(!isCurrentlyMonitoring); 
          if (response.config) { 
              onConfigChange(response.config);
          }
      } else {
          addLog({ message: response.message, type: 'error' });
      }
    } catch (e) {
        addLog({message: "Error toggling monitoring.", type: 'error'});
    } finally {
        setIsTogglingMonitor(false);
    }
  }, [initialConfig, isCurrentlyMonitoring, addLog, setIsCurrentlyMonitoring, onConfigChange, form]);


  const hasActiveConfig = !!(initialConfig || (formSubmitState?.success && formSubmitState.config));

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <Settings className="mr-2 h-6 w-6 text-primary" />
          FTP Configuration
        </CardTitle>
        <CardDescription>
          Configure FTP server details, local storage path, and folders to monitor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Server Details Section */}
            <section className="space-y-6">
              <h3 className="text-xl font-semibold text-foreground border-b pb-2">FTP Server & Local Path</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="server.host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FTP Host</FormLabel>
                      <FormControl>
                        <Input placeholder="ftp.example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="server.port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="21" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="server.username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="ftpuser" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="server.password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Optional" {...field} />
                      </FormControl>
                      <FormDescription>Leave blank for anonymous FTP or if not required.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="server.localPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Root Local Server Path</FormLabel>
                    <FormControl>
                      <Input className="font-mono" placeholder="ftp_downloads" {...field} />
                    </FormControl>
                    <FormDescription>Root path to save all downloaded files. Fetched files will be placed in subfolders here named after their 'Monitored Folder Name'. Relative paths (e.g., 'ftp_downloads') are inside the project. Absolute paths (e.g., '/var/data') also work.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <Separator />

            {/* Monitored Folders Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-foreground">Monitored Folders</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: "", remotePath: "/", interval: "5" })}
                  disabled={isConfigSubmitting || isTogglingMonitor}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Folder
                </Button>
              </div>
              {fields.map((item, index) => (
                <Card key={item.id} className="p-4 bg-muted/30">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-md text-foreground">Folder #{index + 1}</h4>
                    {fields.length > 1 && (
                         <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => remove(index)} 
                            className="text-destructive hover:text-destructive/80"
                            disabled={isConfigSubmitting || isTogglingMonitor}
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove Folder</span>
                        </Button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`folders.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Folder Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Satellite Images" {...field} />
                          </FormControl>
                          <FormDescription>A user-friendly name for this folder configuration. This will also be used as the subfolder name locally.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`folders.${index}.remotePath`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>FTP Remote Path</FormLabel>
                          <FormControl>
                            <Input className="font-mono" placeholder="/path/on/ftp/" {...field} />
                          </FormControl>
                          <FormDescription>The folder on the FTP server to monitor for this entry. Must start with /.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`folders.${index}.interval`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Polling Interval (minutes)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="5" {...field} />
                          </FormControl>
                          <FormDescription>How often to check this specific FTP folder.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Card>
              ))}
               {form.formState.errors.folders && !form.formState.errors.folders.message && (
                <FormMessage>{form.formState.errors.folders.root?.message || form.formState.errors.folders.message}</FormMessage>
              )}
              {Array.isArray(form.formState.errors.folders) && form.formState.errors.folders.map((folderError, index) => {
                if (folderError && folderError.root) { // If Zod array min length error lands on root of array
                    return <FormMessage key={`folder-root-error-${index}`}>{folderError.root.message}</FormMessage>;
                }
                return null;
              })}

            </section>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button type="submit" className="w-full sm:w-auto" disabled={isConfigSubmitting || isTogglingMonitor}>
                {isConfigSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                {hasActiveConfig ? "Update & Restart Monitoring" : "Apply & Start Monitoring"}
              </Button>
              <Button 
                type="button" 
                variant={isCurrentlyMonitoring ? "destructive" : "default"} 
                onClick={handleToggleMonitoring}
                className="w-full sm:w-auto"
                disabled={isConfigSubmitting || isTogglingMonitor || !hasActiveConfig}
              >
                {isTogglingMonitor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                  isCurrentlyMonitoring ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />
                }
                {isCurrentlyMonitoring ? "Stop Monitoring" : "Start Monitoring"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    