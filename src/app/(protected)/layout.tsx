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
import { SidebarDisplayProvider } from '@/components/ui/sidebar-display-provider';
import { ShowQueryParams } from '@/components/show-query-params';

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  return (
    <SidebarDisplayProvider showSidebar={true}>
      <SidebarProvider defaultOpen={true}>
        
        <SidebarInset>
          {/* Header bar: title left, user/logout right */}
          <header className="w-full flex items-center bg-white justify-between gap-4 px-6 py-4 border-b bg-background/80 sticky top-0 z-30">
            {/* Title box */}
            <div className="flex items-center px-4 py-2">
              <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">NiMet-SADIS</h1>
            </div>
            {/* User info and logout box */}
            <div className="flex items-center gap-4 justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{session?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-foreground">{session?.username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{session?.roles.join(', ')}</p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </header>
          <ShowQueryParams />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </SidebarDisplayProvider>
  );
}
