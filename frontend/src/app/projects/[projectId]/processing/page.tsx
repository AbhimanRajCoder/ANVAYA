"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProcessingStatus } from "@/hooks/useProcessingStatus";
import { startProcessing } from "@/lib/api/processing";
import {
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  Loader2,
  Map,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
  WifiOff,
} from "lucide-react";
import { getProjectStatusLabel, getProjectStatusColor } from "@/lib/projectUtils";

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [triggering, setTriggering] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [autoRedirected, setAutoRedirected] = useState<boolean>(false);

  const {
    status,
    progress,
    tilesProcessed,
    totalTiles,
    message,
    error,
    isPolling,
    logs,
    connectionInterrupted,
    startPolling,
    stopPolling,
    refreshStatus,
  } = useProcessingStatus(projectId);

  // Auto trigger start on mount if status is UPLOADED
  useEffect(() => {
    const checkAndStart = async () => {
      try {
        // Wait for the hook's initial fetch to sync state
        const currentData = await refreshStatus();
        // Since refreshStatus does not return data, we check status directly
      } catch (err) {
        console.error("Initial refresh status failed:", err);
      }
    };
    checkAndStart();
  }, [projectId]);

  const hasTriggeredRef = useRef(false);

  // If status updates to UPLOADED, trigger start automatically
  useEffect(() => {
    if (status === "UPLOADED" && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      const triggerAI = async () => {
        setTriggering(true);
        try {
          console.log("Auto-triggering AI processing for project:", projectId);
          await startProcessing(projectId);
          startPolling();
        } catch (err) {
          console.error("Auto-start failed:", err);
          hasTriggeredRef.current = false;
        } finally {
          setTriggering(false);
        }
      };
      triggerAI();
    }
  }, [status, projectId, startPolling]);

  // Elapsed time counter
  useEffect(() => {
    const active = ["PREPROCESSING", "TILING", "AI_INFERENCE", "VECTORIZATION"].includes(status);
    if (!active) return;
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Auto-redirect to workspace on completion
  useEffect(() => {
    if (status === "COMPLETED" && !autoRedirected) {
      setAutoRedirected(true);
      const timer = setTimeout(() => {
        router.push(`/projects/${projectId}/review`);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [status, autoRedirected, projectId, router]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const terminalRef = useRef<HTMLDivElement>(null);

  const handleRetry = async () => {
    setTriggering(true);
    try {
      await startProcessing(projectId);
      startPolling();
    } catch (err) {
      console.error("Failed to retry:", err);
    } finally {
      setTriggering(false);
    }
  };

  // Helper to determine status icon for each step
  const renderStep = (
    stepLabel: string,
    stepDescription: string,
    stepStates: string[]
  ) => {
    let stepStatus: "completed" | "active" | "pending" | "failed" = "pending";

    const stagesList = [
      "UPLOADED",
      "PREPROCESSING",
      "TILING",
      "AI_INFERENCE",
      "VECTORIZATION",
      "COMPLETED",
    ];

    const currentActiveIndex = stagesList.indexOf(status);
    const stepIndex = stagesList.indexOf(stepStates[0]);

    if (status === "FAILED" && stepStates.includes("AI_INFERENCE")) {
      stepStatus = "failed";
    } else if (status === "COMPLETED") {
      stepStatus = "completed";
    } else if (stepStates.includes(status)) {
      stepStatus = "active";
    } else if (currentActiveIndex > stepIndex) {
      stepStatus = "completed";
    } else {
      stepStatus = "pending";
    }

    return (
      <div className="flex items-start gap-4 p-4 border-b border-hairline last:border-b-0">
        <div className="shrink-0 mt-0.5">
          {stepStatus === "completed" && (
            <div className="h-[24px] w-[24px] rounded-full bg-survey-navy flex items-center justify-center">
              <CheckCircle2 className="h-3 w-3 text-white" />
            </div>
          )}
          {stepStatus === "active" && (
            <div className="h-[24px] w-[24px] rounded-full bg-cadastral-rust flex items-center justify-center">
              <Loader2 className="h-3 w-3 text-white animate-spin" />
            </div>
          )}
          {stepStatus === "pending" && (
            <div className="h-[24px] w-[24px] rounded-full border border-hairline flex items-center justify-center" />
          )}
          {stepStatus === "failed" && (
            <div className="h-[24px] w-[24px] rounded-full bg-conflict-rust flex items-center justify-center">
              <XCircle className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p
            className={`text-body font-semibold ${
              stepStatus === "completed" || stepStatus === "active"
                ? "text-survey-navy"
                : "text-instrument-gray"
            }`}
          >
            {stepLabel}
          </p>
          <p className="text-caption text-instrument-gray">{stepDescription}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col min-h-full">
      {/* Light header */}
      <div className="bg-white w-full border-b border-hairline pt-10 pb-8 px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-caption text-fog font-plex-mono uppercase tracking-wider block mb-2">
              AI Core Execution
            </span>
            <h1 className="text-display-sm font-semibold text-survey-navy tracking-display-sm">
              Feature Extraction Progress
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {status === "COMPLETED" && (
              <button
                onClick={() => router.push(`/projects/${projectId}/review`)}
                className="flex items-center gap-2 bg-survey-navy hover:bg-deep-chart text-white px-[20px] py-[10px] rounded-[4px] text-[14px] font-medium transition-colors shadow-xs"
              >
                <Map className="h-4 w-4" />
                Open GIS Workspace
              </button>
            )}

            {status === "FAILED" && (
              <button
                onClick={handleRetry}
                disabled={triggering}
                className="flex items-center gap-2 bg-cadastral-rust hover:bg-conflict-rust text-white px-[20px] py-[10px] rounded-[4px] text-[14px] font-medium transition-colors shadow-xs"
              >
                {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Retry Extraction
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="w-full bg-paper flex-1 py-12 px-8">
        <div className="max-w-[1440px] mx-auto">
          {connectionInterrupted && (
            <div className="bg-rust-wash border border-conflict-rust/30 p-4 rounded-[6px] flex items-center gap-3 text-conflict-rust mb-6">
              <WifiOff className="h-5 w-5 shrink-0 animate-pulse" />
              <div>
                <span className="text-caption font-bold block uppercase tracking-wider">Connection Interrupted</span>
                <span className="text-caption font-medium block mt-0.5">
                  Lost contact with the FastAPI server. Retrying status check in the background... (AI process is still running).
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              
              {/* Progress Section */}
              <div className="bg-white border border-hairline rounded-[6px] p-6 shadow-xs">
                <div className="flex items-center justify-between text-caption font-plex-mono uppercase tracking-wider mb-4">
                  <span className="text-instrument-gray">Pipeline Progress</span>
                  <span className="text-survey-navy font-semibold">{progress}%</span>
                </div>
                
                <div className="w-full bg-grid-wash h-[8px] rounded-full overflow-hidden relative">
                  <div
                    className="bg-survey-navy h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                {status === "AI_INFERENCE" && totalTiles > 0 && (
                  <div className="mt-4 flex justify-between items-center text-caption font-plex-mono bg-paper border border-hairline px-4 py-3 rounded-[4px]">
                    <span className="text-instrument-gray">Processing Tiles:</span>
                    <span className="text-survey-navy font-semibold">
                      {tilesProcessed} / {totalTiles} tiles
                    </span>
                  </div>
                )}

                {["PREPROCESSING", "TILING", "AI_INFERENCE", "VECTORIZATION"].includes(status) && (
                  <div className="mt-4 flex justify-between items-center text-caption font-plex-mono bg-paper border border-hairline px-4 py-3 rounded-[4px]">
                    <span className="text-instrument-gray">Elapsed Time:</span>
                    <span className="text-survey-navy font-semibold">{formatElapsed(elapsedSec)}</span>
                  </div>
                )}

                {status === "COMPLETED" && (
                  <div className="mt-4 flex items-center gap-2 text-verified-green text-caption font-semibold bg-[#e7f4ec] border border-[#d1eadd] p-4 rounded-[4px]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Processing complete — Redirecting to GIS Workspace...</span>
                  </div>
                )}
              </div>

              {/* Terminal Dark Ops Band */}
              <div className="bg-[#0b1b2a] border border-[#0f2438] rounded-[6px] overflow-hidden shadow-xs flex flex-col h-[400px]">
                <div className="bg-survey-navy border-b border-[#0f2438] px-4 py-3 flex items-center justify-between select-none">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]"></div>
                    </div>
                    <span className="text-[11px] text-fog font-plex-mono font-medium uppercase tracking-wider ml-2">
                      Pipeline Console
                    </span>
                  </div>
                  {isPolling && (
                    <span className="flex items-center gap-1.5 text-[11px] text-cadastral-rust font-plex-mono">
                      <span className="h-2 w-2 rounded-full bg-cadastral-rust animate-pulse"></span>
                      Streaming
                    </span>
                  )}
                </div>
                
                <div ref={terminalRef} className="flex-1 p-5 overflow-y-auto font-plex-mono text-[12px] leading-[1.6] select-text flex flex-col-reverse bg-[#07131e]">
                  {logs.length === 0 ? (
                    <span className="text-instrument-gray italic">Awaiting connection...</span>
                  ) : (
                    [...logs].reverse().map((log, reversedIndex) => {
                      const originalIndex = logs.length - 1 - reversedIndex;
                      let colorClass = "text-[#8fa3b7]";
                      if (log.includes("SUCCESS:")) colorClass = "text-[#27c93f] font-semibold";
                      else if (log.includes("ERROR:") || log.includes("FAILED:")) colorClass = "text-[#ff5f56] font-semibold";
                      else if (log.includes("AI MODEL:")) colorClass = "text-[#84a9e1]";
                      else if (log.includes("WARNING:")) colorClass = "text-[#ffbd2e]";
                      
                      return (
                        <div key={originalIndex} className={`${colorClass} break-all`}>
                          {log}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* Error Message Box */}
              {(error || status === "FAILED") && !connectionInterrupted && (
                <div className="bg-rust-wash border border-conflict-rust/30 p-4 rounded-[6px] flex items-start gap-3 text-conflict-rust">
                  <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-caption font-bold block uppercase tracking-wider mb-1">Extraction Failed</span>
                    <span className="text-caption block leading-relaxed">
                      {error || "An error occurred during Model 1 inference. Check console logs."}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-8">
              {/* Stepper block */}
              <div className="bg-white border border-hairline rounded-[6px] p-6 shadow-xs">
                <span className="text-caption text-fog font-plex-mono uppercase tracking-wider block mb-6">
                  Execution Stages
                </span>
                <div className="flex flex-col">
                  {renderStep(
                    "Data Preprocessing",
                    "Validating orthomosaic, reading GeoTIFF tags",
                    ["PREPROCESSING"]
                  )}
                  {renderStep(
                    "Image Tiling",
                    "Subdividing into 512x512 grid tiles",
                    ["TILING"]
                  )}
                  {renderStep(
                    "AI Footprints",
                    "DeepLabV3+ ResNet50 inference",
                    ["AI_INFERENCE"]
                  )}
                  {renderStep(
                    "Vectorization",
                    "Converting confidence masks to geometric polygons",
                    ["VECTORIZATION"]
                  )}
                  {renderStep(
                    "Database Indexing",
                    "PostGIS geometry insertion",
                    ["COMPLETED"]
                  )}
                </div>
              </div>

              {/* Model info */}
              <div className="bg-survey-navy text-white rounded-[6px] p-6 shadow-xs relative overflow-hidden bg-grid-texture">
                <span className="text-caption text-fog font-plex-mono uppercase tracking-wider mb-6 block">Model Registry</span>
                
                <div className="bg-deep-chart border border-slate-blue/30 p-5 rounded-[6px] space-y-3 relative mb-4">
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 text-[10px] text-verified-green bg-[#e7f4ec] border border-verified-green/20 px-2 py-0.5 rounded-[3px] font-plex-mono font-bold tracking-wider uppercase">
                    ACTIVE
                  </div>
                  <div className="space-y-1">
                    <span className="text-caption text-slate-blue font-plex-mono uppercase tracking-wider block">Model 1</span>
                    <h4 className="font-semibold text-[16px]">Building Footprints</h4>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-blue/20 text-caption font-plex-mono text-fog mt-2">
                    <p>Arch: DeepLabV3+ ResNet50</p>
                    <p>Target Class: Building (1)</p>
                  </div>
                </div>
              </div>

              <div className="bg-deep-chart border border-slate-blue/30 p-5 rounded-[6px] space-y-3 relative opacity-60">
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 text-[10px] text-review-amber bg-[#fbf0d9] border border-review-amber/20 px-2 py-0.5 rounded-[3px] font-plex-mono font-bold tracking-wider uppercase">
                    INTEGRATION READY
                  </div>
                  <div className="space-y-1">
                    <span className="text-caption text-slate-blue font-plex-mono uppercase tracking-wider block">Model 2</span>
                    <h4 className="font-semibold text-[16px]">Parcel Boundaries</h4>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-blue/20 text-caption font-plex-mono text-fog mt-2">
                    <p>Arch: SegFormer</p>
                    <p>Target: Parcel Boundary Detection</p>
                  </div>
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
