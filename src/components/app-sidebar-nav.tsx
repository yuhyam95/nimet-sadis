
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
    { href: '/', label: 'Home', icon: Home, tooltip: 'Go to Homepage' },
    { href: '/opmet', label: 'OPMET', icon: Cloud, tooltip: 'View OPMET Data' },
    { href: '/sigmet', label: 'SIGMET', icon: AlertTriangle, tooltip: 'View SIGMETs' },
    { href: '/volcanic-ash', label: 'Volcanic Ash', icon: MountainSnow, tooltip: 'View Volcanic Ash Data' },
    { href: '/tropical-cyclone', label: 'Cyclones', icon: Tornado, tooltip: 'View Tropical Cyclone Data' },
    { href: '/ftp-activity', label: 'FTP', icon: Network, tooltip: 'FTP Activity & Fetched Files' },
    { href: '/api-placeholder', label: 'API', icon: Code, tooltip: 'API Settings (Placeholder)', disabled: true },
    { href: '/logs', label: 'Logs', icon: FileText, tooltip: 'View Logs', requiredRoles: ['admin'] },
    { href: '/user-management', label: 'Users', icon: Users, tooltip: 'Manage Users', requiredRoles: ['admin'] }, 
    { href: '/configuration', label: 'Configuration', icon: Settings, tooltip: 'FTP Configuration', requiredRoles: ['admin'] },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (!item.requiredRoles) {
      return true; // Item is visible to all authenticated users
    }
    // Check if the user has at least one of the required roles
    return item.requiredRoles.some(role => session?.roles.includes(role));
  });

  return (
    <SidebarMenu>
      {menuItems.map((item) => (
        <SidebarMenuItem key={item.label}>
          {item.disabled ? (
            <SidebarMenuButton tooltip={item.tooltip} disabled>
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          ) : (
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
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
