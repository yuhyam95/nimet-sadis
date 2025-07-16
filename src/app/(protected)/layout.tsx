'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionToken } from '@/lib/session-client';
import { jwtDecode } from 'jwt-decode';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarDisplayProvider } from '@/components/ui/sidebar-display-provider';
import { ShowQueryParams } from '@/components/show-query-params';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [session, setSession] = useState<any>(undefined); // undefined = loading

  useEffect(() => {
    const token = getSessionToken();
    console.log('Layout token:', token);
    if (!token) {
      setSession(null);
      router.replace('/login');
      return;
    }
    // Decode JWT to get session info
    try {
      const decoded = jwtDecode(token);
      console.log('Decoded session:', decoded);
      setSession(decoded);
    } catch (e) {
      setSession(null);
      router.replace('/login');
    }
  }, [router]);

  if (session === undefined) {
    console.log('Session is loading...');
    // Loading state: render a blank div or spinner
    return <div />;
  }
  if (!session) {
    console.log('No session, not rendering children');
    return null;
  }
  console.log('Session:', session);

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
                  <p className="text-xs text-muted-foreground capitalize">{session?.roles?.join(', ')}</p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </SidebarDisplayProvider>
  );
}
