"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject } from "@/lib/api/projects";
import { startProcessing } from "@/lib/api/processing";
import { Project } from "@/types";
import { useProcessingStatus } from "@/hooks/useProcessingStatus";
import {
  Calendar,
  Cpu,
  Database,
  FileImage,
  Globe,
  Loader2,
  Map,
  Maximize2,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Shield,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  getProjectStatusLabel,
  getProjectStatusColor,
  isProcessing as checkProcessing,
  isCompleted,
  isFailed,
} from "@/lib/projectUtils";

export default function ProjectOverview() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<boolean>(false);

  // Load project details initially
  const fetchProjectDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch (err: any) {
      console.error("Failed to load project details:", err);
      setError(err.message || "Failed to load project details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  // Hook into live processing status (backend source of truth)
  const {
    status: liveStatus,
    progress: liveProgress,
    tilesProcessed: liveTilesProcessed,
    totalTiles: liveTotalTiles,
    message: liveMessage,
    error: liveError,
    isPolling,
  } = useProcessingStatus(projectId, project?.status || "UPLOADED");

  // Keep project local status synchronized with live status
  useEffect(() => {
    if (project && liveStatus && project.status !== liveStatus) {
      setProject({
        ...project,
        status: liveStatus,
        progress: liveProgress,
        tiles_processed: liveTilesProcessed,
        total_tiles: liveTotalTiles,
      });
    }
  }, [liveStatus, liveProgress, liveTilesProcessed, liveTotalTiles, project]);

  const handleStartAI = async () => {
    if (!project) return;
    setTriggering(true);
    try {
      await startProcessing(project.id);
      // Navigate to the full processing status/console page
      router.push(`/projects/${project.id}/processing`);
    } catch (err: any) {
      console.error("Failed to start processing:", err);
      alert(err.response?.data?.detail || "Failed to trigger AI pipeline.");
      setTriggering(false);
    }
  };

  const calculateArea = (bounds: number[] | null) => {
    if (!bounds || bounds.length !== 4) return "N/A";
    const [minx, miny, maxx, maxy] = bounds;
    
    // Check if projected CRS coordinates (like UTM)
    const isProjected = Math.abs(maxx) > 180 || Math.abs(maxy) > 90;
    
    let areaSqM = 0;
    if (!isProjected) {
      // Geographic Coordinates (Lat/Lng) - EPSG:4326
      const dx = Math.abs(maxx - minx);
      const dy = Math.abs(maxy - miny);
      const latRad = ((miny + maxy) / 2) * (Math.PI / 180);
      const widthM = dx * 111320 * Math.cos(latRad);
      const heightM = dy * 110540;
      areaSqM = widthM * heightM;
    } else {
      // Metric coordinates (UTM, Web Mercator, etc.)
      const dx = Math.abs(maxx - minx);
      const dy = Math.abs(maxy - miny);
      areaSqM = dx * dy;
    }

    if (areaSqM >= 10000) {
      const ha = areaSqM / 10000;
      return `${ha.toLocaleString(undefined, { maximumFractionDigits: 2 })} hectares (${areaSqM.toLocaleString(
        undefined,
        { maximumFractionDigits: 0 }
      )} m²)`;
    }
    return `${areaSqM.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="text-verified-green bg-[#e7f4ec] px-2 py-0.5 rounded-[3px] text-[12px] font-plex-mono uppercase tracking-wider font-medium">VERIFIED</span>;
      case "FAILED":
        return <span className="text-conflict-rust bg-rust-wash px-2 py-0.5 rounded-[3px] text-[12px] font-plex-mono uppercase tracking-wider font-medium">CONFLICT</span>;
      case "UPLOADED":
        return <span className="text-instrument-gray bg-grid-wash px-2 py-0.5 rounded-[3px] text-[12px] font-plex-mono uppercase tracking-wider font-medium">PENDING</span>;
      default:
        return <span className="text-review-amber bg-[#fbf0d9] px-2 py-0.5 rounded-[3px] text-[12px] font-plex-mono uppercase tracking-wider font-medium">REVIEW</span>;
    }
  };

  if (loading || !project) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="h-8 w-8 text-survey-navy animate-spin" />
        <span className="text-instrument-gray font-plex-mono text-caption uppercase tracking-wider font-semibold">Loading Mission Control...</span>
      </div>
    );
  }

  const activeStatus = project.status;
  const isCurrentlyProcessing = checkProcessing(activeStatus);

  const renderPipelineStepper = (currentStatus: string) => {
    const stages = [
      { key: "UPLOADED", label: "Upload & Verify" },
      { key: "PREPROCESSING", label: "Preprocessing" },
      { key: "TILING", label: "Image Tiling" },
      { key: "AI_INFERENCE", label: "AI Footprints" },
      { key: "VECTORIZATION", label: "Vectorization" },
      { key: "COMPLETED", label: "Integration" },
    ];

    const getStageIndex = (status: string) => {
      if (status === "FAILED") return 3; // Highlight inference/vectorization step on failure
      const idx = stages.findIndex((s) => s.key === status);
      return idx === -1 ? 0 : idx;
    };

    const currentIndex = getStageIndex(currentStatus);

    return (
      <div className="bg-white border border-hairline rounded-[6px] p-6 shadow-xs">
        <h3 className="text-subheading font-semibold text-survey-navy tracking-tight mb-8">Pipeline Execution</h3>
        
        <div className="relative flex justify-between items-center w-full">
          {/* Connecting Line */}
          <div className="absolute left-0 top-4 w-full h-[1px] bg-hairline -z-10 transform translate-y-1/2"></div>
          
          {stages.map((stage, idx) => {
            const isCompletedStep = idx < currentIndex || currentStatus === "COMPLETED";
            const isActiveStep = idx === currentIndex && currentStatus !== "COMPLETED" && currentStatus !== "FAILED";
            const isFailedStep = currentStatus === "FAILED" && idx === currentIndex;
            
            let nodeBg = "bg-white";
            let nodeBorder = "border-hairline";
            
            if (isCompletedStep) {
              nodeBg = "bg-survey-navy";
              nodeBorder = "border-survey-navy";
            } else if (isActiveStep) {
              nodeBg = "bg-cadastral-rust";
              nodeBorder = "border-cadastral-rust";
            } else if (isFailedStep) {
              nodeBg = "bg-conflict-rust";
              nodeBorder = "border-conflict-rust";
            }

            return (
              <div key={stage.key} className="flex flex-col items-center gap-2">
                <div className={`h-[32px] w-[32px] rounded-full border flex items-center justify-center ${nodeBg} ${nodeBorder}`}>
                  {isCompletedStep && <CheckCircle2 className="h-4 w-4 text-white" />}
                  {isActiveStep && <Loader2 className="h-4 w-4 text-white animate-spin" />}
                  {isFailedStep && <XCircle className="h-4 w-4 text-white" />}
                </div>
                <span className={`text-[12px] font-medium ${isCompletedStep || isActiveStep ? "text-survey-navy" : "text-instrument-gray"} text-center`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col min-h-full">
      {/* Light operations header */}
      <div className="bg-white w-full border-b border-hairline pt-10 pb-10 px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <span className="text-caption text-fog font-plex-mono uppercase tracking-wider">Mission Control Center</span>
            <div className="flex items-center gap-4">
              <h1 className="text-display-sm font-semibold text-survey-navy tracking-display-sm">
                {project.name}
              </h1>
              {getStatusBadge(activeStatus)}
            </div>
            <div className="flex items-center gap-2 text-data-mono font-plex-mono text-instrument-gray">
              <span>ID: {project.id}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeStatus === "UPLOADED" && (
              <button
                onClick={handleStartAI}
                disabled={triggering}
                className="bg-survey-navy text-white text-[14px] font-medium rounded-[4px] px-[20px] py-[10px] shadow-xs hover:bg-deep-chart transition-colors flex items-center gap-2"
              >
                {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                Start AI Processing
              </button>
            )}

            {isCurrentlyProcessing && (
              <button
                onClick={() => router.push(`/projects/${project.id}/processing`)}
                className="bg-survey-navy text-white text-[14px] font-medium rounded-[4px] px-[20px] py-[10px] shadow-xs animate-pulse flex items-center gap-2"
              >
                <Cpu className="h-4 w-4 animate-spin text-white" />
                Monitor AI Progress ({liveProgress}%)
              </button>
            )}

            {activeStatus === "COMPLETED" && (
              <>
                <button
                  onClick={() => router.push(`/projects/${project.id}/map`)}
                  className="bg-survey-navy text-white text-[14px] font-medium rounded-[4px] px-[20px] py-[10px] shadow-xs hover:bg-deep-chart transition-colors flex items-center gap-2"
                >
                  <Map className="h-4 w-4" />
                  GIS Workspace
                </button>
                <button
                  onClick={() => router.push(`/projects/${project.id}/review`)}
                  className="bg-transparent border border-hairline text-survey-navy text-[14px] font-medium rounded-[4px] px-[20px] py-[10px] hover:bg-grid-wash transition-colors flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Human Review
                </button>
                <button
                  onClick={() => router.push(`/projects/${project.id}/results`)}
                  className="bg-transparent border border-hairline text-survey-navy text-[14px] font-medium rounded-[4px] px-[20px] py-[10px] hover:bg-grid-wash transition-colors flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Metrics
                </button>
              </>
            )}

            {activeStatus === "FAILED" && (
              <button
                onClick={handleStartAI}
                disabled={triggering}
                className="bg-cadastral-rust text-white text-[14px] font-medium rounded-[4px] px-[20px] py-[10px] shadow-xs hover:bg-conflict-rust transition-colors flex items-center gap-2"
              >
                {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Restart AI Processing
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full bg-paper flex-1 py-12 px-8">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            {/* Pipeline Stepper */}
            {renderPipelineStepper(activeStatus)}

            {/* Spatial Info Card */}
            <div className="bg-white border border-hairline rounded-[6px] p-6 shadow-xs">
              <h3 className="text-subheading font-semibold text-survey-navy tracking-tight mb-6">Geospatial Specifications</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-caption font-semibold uppercase text-fog tracking-wider block">Reference Projection</span>
                  <div className="bg-paper border border-hairline px-3 py-2 rounded-[4px] inline-flex font-plex-mono text-[13px] text-survey-navy">
                    {project.crs || "Local Grid (Unprojected)"}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-caption font-semibold uppercase text-fog tracking-wider block">Survey Extent Area</span>
                  <div className="bg-paper border border-hairline px-3 py-2 rounded-[4px] inline-flex font-plex-mono text-[13px] text-survey-navy">
                    {calculateArea(project.bounds)}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-caption font-semibold uppercase text-fog tracking-wider block">Image Data Type</span>
                  <div className="bg-paper border border-hairline px-3 py-2 rounded-[4px] inline-flex font-plex-mono text-[13px] text-survey-navy">
                    GeoTIFF Orthomosaic
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-caption font-semibold uppercase text-fog tracking-wider block">Registration Date</span>
                  <div className="bg-paper border border-hairline px-3 py-2 rounded-[4px] inline-flex font-plex-mono text-[13px] text-survey-navy">
                    {new Date(project.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-hairline space-y-1">
                <span className="text-caption font-semibold uppercase text-fog tracking-wider block">Source File</span>
                <div className="font-plex-mono text-[13px] text-instrument-gray break-all select-all">
                  {project.source_file}
                </div>
              </div>
            </div>

            <div className="bg-white border border-hairline rounded-[6px] p-6 shadow-xs">
              <h3 className="text-subheading font-semibold text-survey-navy tracking-tight mb-2">Survey Context Notes</h3>
              <p className="text-body text-instrument-gray leading-relaxed">
                {project.description || "No specific survey context or flight notes provided."}
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Notice */}
            <div className="bg-rust-wash border border-conflict-rust/20 p-5 rounded-[6px]">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-conflict-rust shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-caption font-bold text-conflict-rust uppercase tracking-wider">Human-In-The-Loop</h4>
                  <p className="text-caption text-conflict-rust leading-relaxed">
                    ANVAYA uses Deep Learning models to extract features. Expert surveyors must verify and adjust shapes locally before compiling final certified cadastral maps.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Models Card */}
            <div className="bg-survey-navy text-white rounded-[6px] p-6 shadow-xs relative overflow-hidden bg-grid-texture">
              <span className="text-caption text-fog font-plex-mono uppercase tracking-wider mb-6 block">AI Model Integration</span>
              
              <div className="bg-deep-chart border border-slate-blue/30 p-5 rounded-[6px] space-y-3 relative mb-4">
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 text-[10px] text-verified-green bg-[#e7f4ec] border border-verified-green/20 px-2 py-0.5 rounded-[3px] font-plex-mono font-bold tracking-wider uppercase">
                  ACTIVE
                </div>
                <div className="space-y-1">
                  <span className="text-caption text-slate-blue font-plex-mono uppercase tracking-wider block">Model 1</span>
                  <h4 className="font-semibold text-[16px]">Building Footprints</h4>
                </div>
                <p className="text-[12px] text-instrument-gray leading-relaxed">
                  Segmenting urban built-up areas and building geometries from drone orthomosaic imagery.
                </p>
                <div className="space-y-1 pt-2 border-t border-slate-blue/20 text-caption font-plex-mono text-fog">
                  <p>Arch: DeepLabV3+ ResNet50</p>
                </div>
              </div>

              <div className="bg-[#0b1b2a] border border-[#0f2438] p-5 rounded-[6px] space-y-3 relative opacity-60">
                <div className="absolute top-3.5 right-3.5 text-[10px] text-fog border border-fog/20 px-2 py-0.5 rounded-[3px] font-plex-mono font-bold tracking-wider uppercase">
                  LOCKED
                </div>
                <div className="space-y-1">
                  <span className="text-caption text-slate-blue font-plex-mono uppercase tracking-wider block">Model 2</span>
                  <h4 className="font-semibold text-[16px]">Parcel Boundaries</h4>
                </div>
                <p className="text-[12px] text-instrument-gray leading-relaxed">
                  Segmenting property partitions, fences, and boundaries.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
