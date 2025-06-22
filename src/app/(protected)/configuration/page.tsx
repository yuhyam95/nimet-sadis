
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import type { AppConfig } from "@/types";
import { submitConfiguration, getAppStatusAndLogs } from "@/lib/actions";

const formSchema = z.object({
  opmetPath: z.string().min(1, "OPMET path is required."),
  sigmetPath: z.string().min(1, "SIGMET path is required."),
  volcanicAshPath: z.string().min(1, "Volcanic Ash path is required."),
  tropicalCyclonePath: z.string().min(1, "Tropical Cyclone path is required."),
});

type FormValues = z.infer<typeof formSchema>;

export default function ConfigurationPage() {
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      opmetPath: "",
      sigmetPath: "",
      volcanicAshPath: "",
      tropicalCyclonePath: "",
    },
  });

  useEffect(() => {
    async function fetchConfig() {
      setPageStatus("loading");
      try {
        const { config } = await getAppStatusAndLogs();
        if (config) {
          form.reset(config);
        } else {
            toast({
                title: "No Configuration Found",
                description: "Loading default values. Please review and save.",
                variant: "default",
            });
        }
        setPageStatus("ready");
      } catch (error) {
        toast({
          title: "Error Loading Configuration",
          description: "Could not retrieve the current folder paths.",
          variant: "destructive",
        });
        setPageStatus("error");
      }
    }
    fetchConfig();
  }, [form, toast]);


  const onSubmit = (data: FormValues) => {
    startSubmitTransition(async () => {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            formData.append(key, value as string);
        });
        
        const result = await submitConfiguration(null, formData);

        if (result.success) {
            toast({
                title: "Configuration Saved",
                description: result.message,
            });
            if(result.config) {
                form.reset(result.config);
            }
        } else {
            toast({
                title: "Error Saving Configuration",
                description: result.message || "An unknown error occurred.",
                variant: "destructive",
            });
        }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">
            Local Folder Configuration
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Set the local directory paths for each data product.
          </p>
        </div>
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        {pageStatus === 'loading' && <p>Loading configuration...</p>}
        {pageStatus === 'error' && <p>Error loading configuration. Please refresh.</p>}
        {pageStatus === 'ready' && (
             <Card className="w-full shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                  <Settings className="mr-2 h-6 w-6 text-primary" />
                  Product Folder Paths
                </CardTitle>
                <CardDescription>
                  Specify the absolute or relative paths on the server where files for each product are stored.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="opmetPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OPMET Path</FormLabel>
                          <FormControl>
                            <Input placeholder="/path/to/opmet_files" {...field} disabled={isSubmitting} />
                          </FormControl>
                           <FormDescription>Folder containing OPMET data.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sigmetPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SIGMET Path</FormLabel>
                          <FormControl>
                            <Input placeholder="/path/to/sigmet_files" {...field} disabled={isSubmitting} />
                          </FormControl>
                          <FormDescription>Folder containing SIGMET data.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="volcanicAshPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Volcanic Ash Path</FormLabel>
                          <FormControl>
                            <Input placeholder="/path/to/volcanic_ash_files" {...field} disabled={isSubmitting} />
                          </FormControl>
                          <FormDescription>Folder containing Volcanic Ash data.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="tropicalCyclonePath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tropical Cyclone Path</FormLabel>
                          <FormControl>
                            <Input placeholder="/path/to/tropical_cyclone_files" {...field} disabled={isSubmitting} />
                          </FormControl>
                          <FormDescription>Folder containing Tropical Cyclone data.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Configuration
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
        )}
      </main>
      <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Configuration Management.</p>
      </footer>
    </div>
  );
}
