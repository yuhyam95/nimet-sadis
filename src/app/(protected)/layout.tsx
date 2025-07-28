'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSessionToken, setSessionToken } from '@/lib/session-client';
import { jwtDecode } from 'jwt-decode';
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
  const LayoutContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [session, setSession] = useState<any>(undefined); // undefined = loading
    const [hideHeader, setHideHeader] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false); // For hydration check

    useEffect(() => {
      if (typeof window === 'undefined') return;

      setIsHydrated(true); // Set hydrated

      const hideHeaderParam = searchParams.get('hideHeader');
      if (hideHeaderParam !== null) {
        if (hideHeaderParam === 'yes') {
          localStorage.setItem('hideHeader', 'yes');
        } else if (hideHeaderParam === 'no') {
          localStorage.setItem('hideHeader', 'no');
        }

        const url = new URL(window.location.href);
        url.searchParams.delete('hideHeader');
        window.history.replaceState({}, '', url.pathname + url.search);
      }

      const hideHeaderFromStorage = localStorage.getItem('hideHeader');
      setHideHeader(hideHeaderFromStorage === 'yes');

      const token = getSessionToken();
      if (!token) {
        setSession(null);
        return;
      }

      try {
        const decoded = jwtDecode(token);
        setSession(decoded);
      } catch (e) {
        setSession(null);
      }
    }, [searchParams]);

    // Redirect to login after hydration and token check
    useEffect(() => {
      if (isHydrated && session === null) {
        router.replace('/login');
      }
    }, [isHydrated, session, router]);

    // Clear localStorage on logout
    useEffect(() => {
      const handleStorageChange = () => {
        if (!getSessionToken()) {
          localStorage.removeItem('hideHeader');
          setHideHeader(false);
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }, []);

    // Loading state
    if (!isHydrated || session === undefined) {
      return <div />;
    }

    if (!session) {
      return null; // Waiting for redirect
    }

    return (
      <SidebarDisplayProvider showSidebar={!hideHeader}>
        <SidebarProvider defaultOpen={!hideHeader}>
          <SidebarInset>
            {!hideHeader && (
              <header className="w-full flex items-center bg-white justify-between gap-4 px-6 py-4 border-b bg-background/80 sticky top-0 z-30">
                <div className="flex items-center px-4 py-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">NiMet-SADIS</h1>
                </div>
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
  };

  return (
    <Suspense fallback={<div>Loading layout...</div>}>
      <LayoutContent />
    </Suspense>
  );
}
