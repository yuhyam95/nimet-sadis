'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSessionToken } from '@/lib/session-client';
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
    const [session, setSession] = useState<any>(undefined); // undefined = loading
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
      if (typeof window === 'undefined') return;

      setIsHydrated(true); // Mark hydrated

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
    }, []);

    // Redirect to login after hydration and token check
    useEffect(() => {
      if (isHydrated && session === null) {
        router.replace('/login');
      }
    }, [isHydrated, session, router]);

    // Loading state
    if (!isHydrated || session === undefined) {
      return <div />;
    }

    if (!session) {
      return null; // Waiting for redirect
    }

    return (
      <SidebarDisplayProvider showSidebar>
        <SidebarProvider defaultOpen>
          <SidebarInset>
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
            {children}
          </SidebarInset>
        </SidebarProvider>
      </SidebarDisplayProvider>
    );
  };

  return (
    // <Suspense fallback={<div>Loading layout...</div>}>
      <LayoutContent />
    //</Suspense>
  );
}
