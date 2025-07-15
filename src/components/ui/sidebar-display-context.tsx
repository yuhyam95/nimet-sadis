"use client";
import React, { createContext, useContext } from 'react';

export const SidebarDisplayContext = createContext<{ showSidebar: boolean }>({ showSidebar: true });
export function useSidebarDisplay() {
  return useContext(SidebarDisplayContext);
} 