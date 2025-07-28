'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { LogoutButton } from '@/components/auth/logout-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarDisplayProvider } from '@/components/ui/sidebar-display-provider';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hideHeader, setHideHeader] = useState(false);

  useEffect(() => {
    console.log('Layout useEffect triggered');
    const hideHeaderParam = searchParams.get('hideHeader');
    const ssoSuccessParam = searchParams.get('sso_success');
    console.log('hideHeaderParam from URL:', hideHeaderParam);
    console.log('ssoSuccessParam from URL:', ssoSuccessParam);

    // Handle SSO success flag and create session token
    if (ssoSuccessParam === '1') {
      console.log('SSO login detected, creating session token');
      const sessionToken = `user_${Date.now()}`;
      localStorage.setItem('session', sessionToken);
      
      // Remove sso_success from URL without triggering a reload
      const url = new URL(window.location.href);
      url.searchParams.delete('sso_success');
      window.history.replaceState({}, '', url.pathname + url.search);
      console.log('Removed sso_success from URL');
    }

    if (hideHeaderParam !== null) { // Check if the parameter exists
      if (hideHeaderParam === 'yes') {
        console.log('Setting hideHeader=yes in localStorage from URL parameter');
        localStorage.setItem('hideHeader', 'yes');
      } else if (hideHeaderParam === 'no') {
        console.log('Setting hideHeader=no in localStorage from URL parameter');
        localStorage.setItem('hideHeader', 'no');
      }

      // Remove hideHeader from URL without triggering a reload
      const url = new URL(window.location.href);
      url.searchParams.delete('hideHeader');
      window.history.replaceState({}, '', url.pathname + url.search);
      console.log('Removed hideHeader from URL');
    }

    // Check for 'hideHeader' flag in localStorage
    const hideHeaderFromStorage = localStorage.getItem('hideHeader');
    console.log('hideHeaderFromStorage:', hideHeaderFromStorage);

    if (hideHeaderFromStorage === 'yes') {
      console.log('Setting hideHeader state to true from localStorage');
      setHideHeader(true);
    } else {
      console.log('Setting hideHeader state to false from localStorage');
      setHideHeader(false);
    }

    // Check for session token in localStorage
    const storedSessionToken = localStorage.getItem('session');
    if (!storedSessionToken) {
      console.log('No session token found, redirecting to login');
      router.replace('/login');
      return;
    }

    console.log('Session check completed');

  }, [router, searchParams]);

  // Effect to remove the localStorage flag on logout
  useEffect(() => {
    const handleStorageChange = () => {
      // Check if user is logged out by checking localStorage
      const isLoggedOut = !localStorage.getItem('session');
      if (isLoggedOut) {
        // If session token is removed (user logged out), clear the hideHeader flag
        console.log('Removing hideHeader from localStorage on logout');
        localStorage.removeItem('hideHeader');
        setHideHeader(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  console.log('hideHeader state before rendering:', hideHeader);

  return (
    <SidebarDisplayProvider showSidebar={!hideHeader}>
      <SidebarProvider defaultOpen={!hideHeader}>
        <SidebarInset>
          {/* Header bar: title left, user/logout right */}
          {!hideHeader && (
            <header className="w-full flex items-center bg-white justify-between gap-4 px-6 py-4 border-b bg-background/80 sticky top-0 z-30">
              {/* Title box */}
              <div className="flex items-center px-4 py-2">
                <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">NiMet-SADIS</h1>
              </div>
              {/* User info and logout box */}
              <div className="flex items-center gap-4 justify-between px-4 py-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-foreground">User</p>
                    <p className="text-xs text-muted-foreground capitalize">user</p>
                  </div>
                </div>
                <LogoutButton />
              </div>
            </header>
          )}
          {children}
        </SidebarInset>
      </SidebarProvider>
    </SidebarDisplayProvider>
  );
}
