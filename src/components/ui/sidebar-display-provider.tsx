"use client";
import { SidebarDisplayContext } from "./sidebar-display-context";

export function SidebarDisplayProvider({
  showSidebar,
  children,
}: {
  showSidebar: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarDisplayContext.Provider value={{ showSidebar }}>
      {children}
    </SidebarDisplayContext.Provider>
  );
} 