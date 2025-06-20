
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
  } from '@/components/ui/sidebar';
import Image from 'next/image';
import { AppSidebarNav } from '@/components/app-sidebar-nav';
import { LogoutButton } from '@/components/auth/logout-button';
import { getSession } from '@/lib/auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default async function ProtectedLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    const session = await getSession();
    
    return (
      <SidebarProvider defaultOpen={true}>
        <Sidebar side="left" collapsible="icon" variant="sidebar">
          <SidebarHeader className="p-4 flex flex-col items-center group-data-[collapsible=icon]:items-start">
            <div
              className="mb-4 flex items-center justify-center group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0.5 group-data-[collapsible=icon]:w-full cursor-default"
            >
              <Image
                src="https://nimet.gov.ng/assets/img/logo.png"
                alt="NiMet-SADIS-Ingest Logo"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <AppSidebarNav />
          </SidebarContent>
          <SidebarFooter className="p-2 flex flex-col gap-2">
            <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-10">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{session?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium text-foreground">{session?.username}</p>
                    <p className="text-xs text-muted-foreground capitalize">{session?.roles.join(', ')}</p>
                </div>
            </div>
            <LogoutButton />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    );
}
