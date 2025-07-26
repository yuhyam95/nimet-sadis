'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSessionToken, setSessionToken } from '@/lib/session-client';
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

function ProtectedLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<any>(undefined); // undefined = loading
  const [hideHeader, setHideHeader] = useState(false);

  useEffect(() => {
    // Handle SSO token from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const sso = url.searchParams.get('sso');
      const tokenFromUrl = url.searchParams.get('token');
      const hideHeaderParam = url.searchParams.get('hideHeader');

      if (sso === '1' && tokenFromUrl) {
        setSessionToken(tokenFromUrl);
        url.searchParams.delete('sso');
        url.searchParams.delete('token');

        // Handle hideHeader based on the query parameter
        if (hideHeaderParam === 'yes') {
          console.log('Setting hideHeader=yes in localStorage from URL parameter');
          localStorage.setItem('hideHeader', 'yes');
        } else if (hideHeaderParam === 'no') {
           console.log('Setting hideHeader=no in localStorage from URL parameter');
           localStorage.setItem('hideHeader', 'no');
        }

        // Remove hideHeader from URL without triggering a reload
        if (hideHeaderParam) {
             url.searchParams.delete('hideHeader');
             window.history.replaceState({}, '', url.pathname + url.search);
        }
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
    }

    const token = getSessionToken();
    console.log('Layout token:', token);
    if (!token) {
      setSession(null);
      router.replace('/login');
      return;
    }
    try {
      const decoded = jwtDecode(token);
      console.log('Decoded session:', decoded);
      setSession(decoded);
    } catch (e) {
      setSession(null);
      router.replace('/login');
    }

  }, [router, searchParams]);

  // Effect to remove the localStorage flag on logout
  useEffect(() => {
    const handleStorageChange = () => {
      if (!getSessionToken()) {
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
          )}
          {children}
        </SidebarInset>
      </SidebarProvider>
    </SidebarDisplayProvider>
  );
}

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    return (
        <Suspense fallback={<div>Loading layout...</div>}>
            <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
        </Suspense>
    )
}
