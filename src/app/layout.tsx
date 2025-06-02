
import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import Image from 'next/image'; // Import next/image
import { AppSidebarNav } from '@/components/app-sidebar-nav';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'NiMet-SADIS-Ingest',
  description: 'Automated SADIS FTP File Ingestion and Local Transfer by Firebase Studio',
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
              <div
                className="mb-4 flex items-center justify-center group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0.5 group-data-[collapsible=icon]:w-full cursor-default"
              >
                <Image
                  src="https://nimet.gov.ng/assets/img/logo.png"
                  alt="NiMet-SADIS-Ingest Logo"
                  width={40} // Adjust width as needed
                  height={40} // Adjust height as needed
                  className="h-10 w-10 object-contain" // Use h-10 w-10 for consistency if needed, or specific pixel values
                />
                <span className="text-xl font-semibold group-data-[collapsible=icon]:hidden ml-2">NiMet-SADIS-Ingest</span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <AppSidebarNav />
            </SidebarContent>
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
