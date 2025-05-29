
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Network, Code, Settings, FileText } from 'lucide-react';

export function AppSidebarNav() {
  const pathname = usePathname();

  const menuItems = [
    { href: '/', label: 'FTP', icon: Network, tooltip: 'FTP Management & Configuration' },
    { href: '/api-placeholder', label: 'API', icon: Code, tooltip: 'API Settings (Placeholder)', disabled: true },
    { href: '/config-placeholder', label: 'Configuration', icon: Settings, tooltip: 'App Configuration (Placeholder)', disabled: true },
    { href: '/logs', label: 'Logs', icon: FileText, tooltip: 'View Logs' },
  ];

  return (
    <SidebarMenu>
      {menuItems.map((item) => (
        <SidebarMenuItem key={item.href}>
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
                isActive={pathname === item.href || (item.href === '/' && pathname.startsWith('/?'))} // Handle query params for root
              >
                <a> {/* This <a> is important for asChild with next/link legacyBehavior */}
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
