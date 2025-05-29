import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Network, Code, Settings, FileText, HomeIcon } from 'lucide-react';

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
              <SidebarMenuButton 
                tooltip="FileFetcher App" 
                className="text-xl font-semibold mb-4 justify-center group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0.5 group-data-[collapsible=icon]:w-full"
                size="lg"
              >
                <HomeIcon className="h-6 w-6 text-primary" />
                <span className="group-data-[collapsible=icon]:hidden ml-2">FileFetcher</span>
              </SidebarMenuButton>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="FTP Management" isActive={true}>
                    <Network />
                    <span>FTP</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="API Settings (Placeholder)">
                    <Code />
                    <span>API</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="App Configuration (Placeholder)">
                    <Settings />
                    <span>Configuration</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="View Logs (Placeholder)">
                    <FileText />
                    <span>Logs</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
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
