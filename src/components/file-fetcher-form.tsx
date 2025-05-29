
"use client";

import type { Control } from "react-hook-form";
import { useActionState } from "react"; // Changed from react-dom
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Settings, Play, StopCircle, Loader2 } from "lucide-react";

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
import type { FtpConfig, LogEntry } from "@/types";
import { submitConfiguration, toggleMonitoring, type ActionResponse } from "@/lib/actions";
import React, { useEffect, useState } from "react";

const formSchema = z.object({
  host: z.string().min(1, { message: "FTP host is required." }),
  port: z.string().refine(val => /^\d+$/.test(val) && parseInt(val, 10) > 0 && parseInt(val, 10) <= 65535, {
    message: "Port must be a number between 1 and 65535.",
  }),
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().optional(),
  remotePath: z.string().min(1, { message: "FTP remote path is required." }).refine(val => val.startsWith('/'), { message: "Remote path must start with /"}),
  localPath: z.string().min(1, { message: "Local server path is required." }).refine(val => val.startsWith('/'), { message: "Local path must start with /"}),
  interval: z.string().refine(val => /^\d+$/.test(val) && parseInt(val, 10) >= 1, {
    message: "Interval must be at least 1 minute.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface FileFetcherFormProps {
  onConfigChange: (config: FtpConfig) => void;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void; // Adjusted to match page.tsx
  initialConfig?: FtpConfig;
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
  // For toggleMonitoring, which takes a boolean, useActionState might not be the ideal hook if not submitting a form.
  // However, to maintain consistency with the error fix and assuming a future where it might evolve, let's keep it.
  // If toggleMonitoring was a simple async function without form state semantics, a direct call would be simpler.
  // The second argument to useActionState (the action function) should match its signature.
  // toggleMonitoring expects a boolean, not FormData.
  // For now, to address the rename, we'll change useFormState to useActionState.
  // The `handleToggleMonitoring` function already handles the direct call, so toggleAction might not be used.
  const [toggleSubmitState, _toggleAction_unused] = useActionState<ActionResponse | null, boolean>(toggleMonitoring, null);
  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false);
  const [isTogglingMonitor, setIsTogglingMonitor] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      host: initialConfig?.host || "",
      port: initialConfig?.port?.toString() || "21",
      username: initialConfig?.username || "",
      password: initialConfig?.password || "",
      remotePath: initialConfig?.remotePath || "/upload/",
      localPath: initialConfig?.localPath || "/data/ftp_files/",
      interval: initialConfig?.interval?.toString() || "5",
    },
  });

  useEffect(() => {
    if (formSubmitState?.success && formSubmitState.config) {
      onConfigChange(formSubmitState.config);
      addLog({ message: formSubmitState.message, type: 'success' });
      setIsCurrentlyMonitoring(true);
    } else if (formSubmitState && !formSubmitState.success) {
      addLog({ message: formSubmitState.message, type: 'error' });
      if (formSubmitState.errorDetails) {
        Object.entries(formSubmitState.errorDetails).forEach(([field, errors]) => {
            form.setError(field as keyof FormValues, { message: errors.join(', ') });
        });
      }
    }
    setIsSubmittingConfig(false);
  }, [formSubmitState, onConfigChange, addLog, form, setIsCurrentlyMonitoring]);

  useEffect(() => {
    if (toggleSubmitState?.success) {
        addLog({ message: toggleSubmitState.message, type: 'info' });
        setIsCurrentlyMonitoring(toggleSubmitState.message.includes("started"));
        if (toggleSubmitState.config) {
            onConfigChange(toggleSubmitState.config);
        }
    } else if (toggleSubmitState && !toggleSubmitState.success) {
        addLog({ message: toggleSubmitState.message, type: 'error' });
    }
    setIsTogglingMonitor(false);
  }, [toggleSubmitState, addLog, setIsCurrentlyMonitoring, onConfigChange]);


  function onSubmit(data: FormValues) {
    setIsSubmittingConfig(true);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
    formAction(formData);
  }

  const handleToggleMonitoring = async () => {
    setIsTogglingMonitor(true);
    // Direct call to the server action as it doesn't rely on FormData from a form submission here.
    const response = await toggleMonitoring(!isCurrentlyMonitoring);
    if (response.success) {
        addLog({ message: response.message, type: 'info' });
        setIsCurrentlyMonitoring(!isCurrentlyMonitoring); // Update local state based on actual action
        if (response.config) {
            onConfigChange(response.config);
        }
    } else {
        addLog({ message: response.message, type: 'error' });
    }
    setIsTogglingMonitor(false);
  };


  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <Settings className="mr-2 h-6 w-6 text-primary" />
          FTP Configuration
        </CardTitle>
        <CardDescription>
          Configure FTP server details, paths, and monitoring interval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control as unknown as Control<FormValues>}
                name="host"
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
                control={form.control as unknown as Control<FormValues>}
                name="port"
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
                control={form.control as unknown as Control<FormValues>}
                name="username"
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
                control={form.control as unknown as Control<FormValues>}
                name="password"
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
              control={form.control as unknown as Control<FormValues>}
              name="remotePath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FTP Remote Path</FormLabel>
                  <FormControl>
                    <Input className="font-mono" placeholder="/path/to/files_on_ftp/" {...field} />
                  </FormControl>
                  <FormDescription>The folder on the FTP server to monitor (e.g., /exports/). Must start with /.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control as unknown as Control<FormValues>}
              name="localPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local Server Path</FormLabel>
                  <FormControl>
                    <Input className="font-mono" placeholder="/path/to/local_storage/" {...field} />
                  </FormControl>
                  <FormDescription>The folder on your local server to save files (e.g., /var/www/html/ftp_downloads/). Must start with /.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control as unknown as Control<FormValues>}
              name="interval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Polling Interval (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5" {...field} />
                  </FormControl>
                  <FormDescription>How often to check the FTP folder for new files.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmittingConfig || isTogglingMonitor}>
                {isSubmittingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                Apply Configuration
              </Button>
              <Button 
                type="button" 
                variant={isCurrentlyMonitoring ? "destructive" : "default"} 
                onClick={handleToggleMonitoring}
                className="w-full sm:w-auto"
                disabled={isSubmittingConfig || isTogglingMonitor || !initialConfig} // Disable if no initialConfig
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

