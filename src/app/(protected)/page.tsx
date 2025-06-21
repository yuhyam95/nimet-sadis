
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-4xl flex items-center justify-between">
        <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-primary tracking-tight">
            Welcome to NiMet-SADIS
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Automated SADIS FTP file ingestion and local transfer. Use the sidebar to navigate to the data pages.
            </p>
        </div>
        <div className="md:hidden">
            <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-4xl space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Dashboard Overview</CardTitle>
            <CardDescription>
              This is the main dashboard. Key metrics and alerts will be displayed here in the future.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please select a data product from the sidebar menu to get started.</p>
          </CardContent>
        </Card>
      </main>
       <footer className="w-full max-w-4xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Dashboard.</p>
      </footer>
    </div>
  );
}
