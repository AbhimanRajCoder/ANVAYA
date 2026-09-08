"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Hide global Header and Sidebar for the full-screen GIS review workspace
  const isGISWorkspace = pathname?.includes("/review") || pathname?.includes("/map") || pathname?.includes("/workspace");

  if (isGISWorkspace) {
    return (
      <main className="flex-1 h-full w-full bg-zinc-950 overflow-hidden flex flex-col">
        <Header />
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
    );
  }

  return (
    <>
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-white">
          {children}
        </main>
      </div>
    </>
  );
}
