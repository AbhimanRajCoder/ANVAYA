"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getSystemHealth } from "@/lib/api/health";
import { SystemHealth } from "@/types";
import { Activity, ShieldAlert, Wifi, WifiOff } from "lucide-react";

import { usePathname } from "next/navigation";

export default function Header() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchHealth = async () => {
    try {
      const data = await getSystemHealth();
      setHealth(data);
    } catch (error) {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Poll every 10 seconds
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const renderHealthBadge = () => {
    if (loading && !health) {
      return (
        <div className="flex items-center gap-2 text-fog font-plex-mono text-caption uppercase px-3 py-1.5 rounded-[3px]">
          <div className="h-2 w-2 rounded-full bg-hairline animate-pulse"></div>
          Checking System
        </div>
      );
    }

    if (!health) {
      return (
        <div className="flex items-center gap-2 text-conflict-rust bg-rust-wash px-3 py-1.5 rounded-[3px] font-plex-mono text-caption uppercase">
          <WifiOff className="h-3.5 w-3.5" />
          <span>SYSTEM OFFLINE</span>
        </div>
      );
    }

    if (health.database !== "connected") {
      return (
        <div className="flex items-center gap-2 text-review-amber bg-[#fbf0d9] px-3 py-1.5 rounded-[3px] font-plex-mono text-caption uppercase">
          <ShieldAlert className="h-3.5 w-3.5 animate-bounce" />
          <span>DB UNAVAILABLE</span>
        </div>
      );
    }

    if (health.model1 !== "loaded") {
      return (
        <div className="flex items-center gap-2 text-review-amber bg-[#fbf0d9] px-3 py-1.5 rounded-[3px] font-plex-mono text-caption uppercase">
          <ShieldAlert className="h-3.5 w-3.5 animate-bounce" />
          <span>MODEL UNAVAILABLE</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-verified-green bg-[#e7f4ec] px-3 py-1.5 rounded-[3px] font-plex-mono text-caption uppercase">
        <Wifi className="h-3.5 w-3.5 animate-pulse" />
        <span>SYSTEM ONLINE</span>
      </div>
    );
  };

  // Determine current stage for the workflow indicator
  let currentStage = 0;
  if (pathname === "/projects/new") currentStage = 1; // DATA
  else if (pathname?.includes("/processing")) currentStage = 2; // PROCESS
  else if (pathname?.includes("/workspace") || pathname?.includes("/map") || pathname?.includes("/review")) {
    currentStage = 3; // MAP/REVIEW
  }
  else if (pathname?.includes("/results")) currentStage = 5; // RESULTS
  else if (pathname?.includes("/export")) currentStage = 6; // EXPORT

  const stages = [
    { num: 1, label: "DATA" },
    { num: 2, label: "PROCESS" },
    { num: 3, label: "MAP" },
    { num: 4, label: "REVIEW" },
    { num: 5, label: "RESULTS" },
    { num: 6, label: "EXPORT" },
  ];

  const renderWorkflowIndicator = () => {
    // Only show the workflow indicator if we are inside a project flow
    if (currentStage === 0) return null;

    return (
      <div className="hidden lg:flex items-center gap-3 font-plex-mono text-[11px] tracking-widest absolute left-1/2 -translate-x-1/2">
        {stages.map((stage, idx) => {
          // Special case: map/review workspace covers both 3 and 4
          const isActive = currentStage === stage.num || (currentStage === 3 && stage.num === 4);
          const isPast = currentStage > stage.num;
          
          return (
            <React.Fragment key={stage.num}>
              <div className={`flex items-center gap-1.5 ${isActive ? "text-survey-navy font-bold" : isPast ? "text-slate-blue" : "text-fog"}`}>
                <span>{String(stage.num).padStart(2, "0")}</span>
                <span>{stage.label}</span>
              </div>
              {idx < stages.length - 1 && (
                <span className="text-hairline">→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <header className="h-16 border-b border-hairline bg-white px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[18px] font-semibold text-survey-navy tracking-tight">
            ANVAYA
          </span>
        </Link>
        <span className="text-caption text-fog font-plex-mono hidden sm:inline-block">
          cadastral intelligence
        </span>
      </div>

      {renderWorkflowIndicator()}

      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/dashboard" className="text-[14px] font-medium text-slate-blue hover:text-survey-navy transition-colors">
            Dashboard
          </Link>
          <Link href="/projects" className="text-[14px] font-medium text-slate-blue hover:text-survey-navy transition-colors">
            Registry
          </Link>
        </nav>
        {renderHealthBadge()}
        <Link
          href="/projects/new"
          className="bg-survey-navy text-white text-[14px] font-medium rounded-[4px] px-[20px] py-[10px] shadow-xs hover:bg-deep-chart transition-colors flex items-center gap-2"
        >
          New Survey
        </Link>
      </div>
    </header>
  );
}
