
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Network, Code, Settings, FileText, Home, Users, Cloud, AlertTriangle, MountainSnow, Tornado } from 'lucide-react';
import type { SessionPayload } from '@/types';

interface AppSidebarNavProps {
  session: SessionPayload | null;
}

export function AppSidebarNav({ session }: AppSidebarNavProps) {
  const pathname = usePathname();

  const allMenuItems = [
    { href: '/', label: 'Home', icon: Home, tooltip: 'Home' },
    { href: '/gridded', label: 'GRIDDED', icon: Network, tooltip: 'View Gridded Data' },
    { href: '/opmet', label: 'OPMET', icon: Cloud, tooltip: 'View OPMET Data' },
    { href: '/sigwx', label: 'SIGWX', icon: AlertTriangle, tooltip: 'View SIGWX Data' },
    { href: '/logs', label: 'Logs', icon: FileText, tooltip: 'View Logs' },
    { href: '/configuration', label: 'Configuration', icon: Settings, tooltip: 'FTP Configuration' },
  ];

  // No filtering needed, all items are public
  const menuItems = allMenuItems;

  return (
    <SidebarMenu>
      {menuItems.map((item) => (
        <SidebarMenuItem key={item.label}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              tooltip={item.tooltip}
              isActive={pathname === item.href || (item.href === '/' && pathname.startsWith('/?'))}
            >
              <a>
                <item.icon />
                <span>{item.label}</span>
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
