
import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenuButton, // Keep for title
  SidebarProvider,
} from '@/components/ui/sidebar';
import { HomeIcon } from 'lucide-react';
import { AppSidebarNav } from '@/components/app-sidebar-nav'; // New import

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FileFetcher App',
  description: 'Automated FTP File Retrieval and Local Transfer by Firebase Studio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider defaultOpen={true}>
          <Sidebar side="left" collapsible="icon" variant="sidebar">
            <SidebarHeader className="p-4 flex flex-col items-center group-data-[collapsible=icon]:items-start">
              {/* Using SidebarMenuButton for styling the app title, not as a functional button here */}
              <div // Changed to div, or use Link if it should go to home
                className="text-xl font-semibold mb-4 flex items-center justify-center group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0.5 group-data-[collapsible=icon]:w-full cursor-default"
              >
                <HomeIcon className="h-6 w-6 text-primary" />
                <span className="group-data-[collapsible=icon]:hidden ml-2">FileFetcher</span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <AppSidebarNav />
            </SidebarContent>
            {/* Example Footer (optional)
            <SidebarFooter className="p-2 group-data-[collapsible=icon]:hidden">
              <p className="text-xs text-center text-muted-foreground">© {new Date().getFullYear()}</p>
            </SidebarFooter>
            */}
          </Sidebar>
          <SidebarInset>
            {children}
            <Toaster />
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
