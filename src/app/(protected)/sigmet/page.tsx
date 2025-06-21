
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function SigmetPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight flex items-center">
            <AlertTriangle className="mr-4 h-10 w-10"/> SIGMET Data
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Monitor significant meteorological phenomena hazardous to aviation.
          </p>
        </div>
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
                <p>This page is under construction. Functionality to view SIGMET data will be available here.</p>
            </CardContent>
        </Card>
      </main>
       <footer className="w-full max-w-3xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS. SIGMET Data.</p>
      </footer>
    </div>
  );
}
