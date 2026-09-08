"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { getBuildings } from "@/lib/api/buildings";
import {
  Calendar,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  MapPin,
  Play,
  PlusCircle,
  TrendingUp,
  Trash2,
} from "lucide-react";

import { deleteProject } from "@/lib/api/projects";

export default function Dashboard() {
  const { projects, loading, error, refreshProjects } = useProjects();
  const [totalBuildings, setTotalBuildings] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to completely delete the survey "${name}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteProject(id);
      await refreshProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  // Compute building counts for completed projects dynamically from Supabase
  const [projectStats, setProjectStats] = useState<Record<string, { total: number, reviewed: number }>>({});

  useEffect(() => {
    const fetchBuildingStats = async () => {
      if (projects.length === 0) return;
      setLoadingStats(true);
      try {
        const completedProjects = projects.filter((p) => p.status === "COMPLETED");
        const statsObj: Record<string, { total: number, reviewed: number }> = {};
        
        const fetchPromises = completedProjects.map(async (p) => {
          try {
            const geojson = await getBuildings(p.id);
            const features = geojson.features || [];
            const reviewed = features.filter((f: any) => 
              f.properties?.review_status === 'approved' || 
              f.properties?.review_status === 'edited' || 
              f.properties?.review_status === 'rejected'
            ).length;
            
            statsObj[p.id] = { total: features.length, reviewed };
            return features.length;
          } catch (err) {
            console.error(`Failed to fetch buildings for project ${p.id}:`, err);
            statsObj[p.id] = { total: 0, reviewed: 0 };
            return 0;
          }
        });
        
        const counts = await Promise.all(fetchPromises);
        const sum = counts.reduce((acc, val) => acc + val, 0);
        setTotalBuildings(sum);
        setProjectStats(statsObj);
      } catch (err) {
        console.error("Failed to load aggregate stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchBuildingStats();
  }, [projects]);

  // Calculate total area mapped (in hectares) across completed projects
  const calculateTotalArea = () => {
    let totalSqM = 0;
    const completed = projects.filter((p) => p.status === "COMPLETED");
    
    completed.forEach((p) => {
      if (!p.bounds || (p.bounds.length !== 4 && p.bounds.length !== 8)) return;
      let minx, miny, maxx, maxy;
      if (p.bounds.length === 8) {
        const xs = [p.bounds[0], p.bounds[2], p.bounds[4], p.bounds[6]];
        const ys = [p.bounds[1], p.bounds[3], p.bounds[5], p.bounds[7]];
        minx = Math.min(...xs);
        maxx = Math.max(...xs);
        miny = Math.min(...ys);
        maxy = Math.max(...ys);
      } else {
        [minx, miny, maxx, maxy] = p.bounds;
      }
      
      const dx = Math.abs(maxx - minx);
      const dy = Math.abs(maxy - miny);
      
      // If bounds are geographic (degrees), convert to meters roughly (1 deg ≈ 111,000m)
      if (dx < 360 && dy < 360) {
        const latRad = ((miny + maxy) / 2) * (Math.PI / 180);
        const widthM = dx * 111320 * Math.cos(latRad);
        const heightM = dy * 110540;
        totalSqM += widthM * heightM;
      } else {
        // Metric coordinates (UTM, Web Mercator etc.)
        totalSqM += dx * dy;
      }
    });

    // Return area in hectares (1 hectare = 10,000 sq meters)
    const hectares = totalSqM / 10000;
    return hectares.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " ha";
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

  return (
    <div className="w-full flex flex-col">
      {/* Dark Ops Band */}
      <div className="bg-survey-navy w-full relative border-b border-hairline overflow-hidden bg-grid-texture pt-[64px] pb-[64px] px-8">
        <div className="max-w-[1440px] mx-auto">
          <h1 className="text-display-sm font-semibold text-white tracking-display-sm mb-12">
            Cadastral Registry
          </h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 min-w-0">
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-caption font-semibold uppercase text-fog tracking-wider truncate">Total Surveys</span>
              {loading ? (
                <div className="h-10 w-24 bg-deep-chart rounded animate-pulse"></div>
              ) : (
                <span className="text-[32px] md:text-[40px] xl:text-[56px] font-plex-mono text-white tracking-display truncate" title={String(projects.length)}>
                  {projects.length}
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-caption font-semibold uppercase text-fog tracking-wider truncate">Completed Surveys</span>
              {loading ? (
                <div className="h-10 w-24 bg-deep-chart rounded animate-pulse"></div>
              ) : (
                <span className="text-[32px] md:text-[40px] xl:text-[56px] font-plex-mono text-white tracking-display truncate" title={String(projects.filter((p) => p.status === "COMPLETED").length)}>
                  {projects.filter((p) => p.status === "COMPLETED").length}
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-caption font-semibold uppercase text-fog tracking-wider truncate">Buildings Detected</span>
              {loading || loadingStats ? (
                <div className="h-10 w-24 bg-deep-chart rounded animate-pulse"></div>
              ) : (
                <span className="text-[32px] md:text-[40px] xl:text-[56px] font-plex-mono text-white tracking-display truncate" title={String(totalBuildings)}>
                  {totalBuildings}
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-caption font-semibold uppercase text-fog tracking-wider truncate">Mapped Area</span>
              {loading || loadingStats ? (
                <div className="h-10 w-32 bg-deep-chart rounded animate-pulse"></div>
              ) : (
                <span className="text-[32px] md:text-[40px] xl:text-[56px] font-plex-mono text-white tracking-display truncate" title={calculateTotalArea()}>
                  {calculateTotalArea()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Light operations canvas */}
      <div className="w-full bg-white flex-1 py-16 px-8">
        <div className="max-w-[1440px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h2 className="text-heading-sm font-semibold text-survey-navy tracking-tight">Survey Registry</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshProjects}
                className="bg-transparent border border-hairline text-survey-navy text-[14px] font-medium rounded-[4px] px-[16px] py-[8px] hover:bg-grid-wash transition-colors"
              >
                Refresh
              </button>
              <Link
                href="/projects/new"
                className="bg-survey-navy text-white text-[14px] font-medium rounded-[4px] px-[20px] py-[8px] shadow-xs hover:bg-deep-chart transition-colors flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                New Survey
              </Link>
            </div>
          </div>

          {error && (
            <div className="bg-rust-wash border border-conflict-rust/30 text-conflict-rust p-4 rounded-[6px] text-body-sm font-medium mb-6">
              {error}
            </div>
          )}

          <div className="border border-hairline rounded-[6px] overflow-hidden bg-white shadow-xs">
            {/* Table Header */}
            <div className="bg-grid-wash grid grid-cols-12 gap-4 p-4 border-b border-hairline text-caption font-semibold uppercase text-instrument-gray tracking-wider">
              <div className="col-span-4 md:col-span-3">Survey Name</div>
              <div className="col-span-2 hidden md:block">Status</div>
              <div className="col-span-2 hidden md:block">Date</div>
              <div className="col-span-2 hidden md:block md:col-span-1">Features</div>
              <div className="col-span-2 hidden md:block">Review</div>
              <div className="col-span-8 md:col-span-2 text-right">Actions</div>
            </div>

            {loading ? (
              <div className="divide-y divide-hairline">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 p-4 animate-pulse items-center">
                    <div className="col-span-4 md:col-span-3 h-4 bg-grid-wash rounded w-3/4"></div>
                    <div className="col-span-2 hidden md:block h-4 bg-grid-wash rounded w-16"></div>
                    <div className="col-span-2 hidden md:block h-4 bg-grid-wash rounded w-24"></div>
                    <div className="col-span-2 hidden md:block h-4 bg-grid-wash rounded w-16"></div>
                    <div className="col-span-2 hidden md:block h-4 bg-grid-wash rounded w-16"></div>
                    <div className="col-span-8 md:col-span-1 h-8 bg-grid-wash rounded justify-self-end w-24"></div>
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center gap-3">
                <Layers className="h-8 w-8 text-fog" />
                <p className="text-body font-medium text-instrument-gray">No surveys found in registry.</p>
                <Link
                  href="/projects/new"
                  className="text-[14px] text-cadastral-rust hover:text-conflict-rust font-medium mt-1"
                >
                  Upload your first drone orthomosaic ➔
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {projects.map((project, idx) => {
                  const stats = projectStats[project.id];
                  const progressPct = stats?.total ? Math.round((stats.reviewed / stats.total) * 100) : 0;
                  
                  return (
                  <div
                    key={project.id}
                    className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-paper transition-colors ${idx % 2 !== 0 ? 'bg-grid-wash/50' : 'bg-white'}`}
                  >
                    <div className="col-span-4 md:col-span-3 flex flex-col gap-1 pr-4">
                      <span className="font-semibold text-survey-navy text-body truncate">{project.name}</span>
                      <span className="text-caption text-instrument-gray truncate hidden sm:block">
                        {project.id}
                      </span>
                    </div>

                    <div className="col-span-2 hidden md:flex items-center">
                      {getStatusBadge(project.status)}
                    </div>

                    <div className="col-span-2 hidden md:flex items-center text-data-mono font-plex-mono text-instrument-gray">
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>

                    <div className="col-span-2 hidden md:flex md:col-span-1 items-center">
                      {project.status === "COMPLETED" ? (
                        <span className="bg-paper px-2 py-0.5 rounded-[3px] border border-hairline text-caption font-plex-mono text-instrument-gray">
                          {stats?.total || 0} structures
                        </span>
                      ) : (
                        <span className="text-fog text-caption">—</span>
                      )}
                    </div>

                    <div className="col-span-2 hidden md:flex items-center">
                      {project.status === "COMPLETED" ? (
                        <div className="flex items-center gap-2 w-full pr-4">
                          <div className="flex-1 h-1.5 bg-grid-wash rounded-full overflow-hidden">
                            <div className="h-full bg-verified-green" style={{ width: `${progressPct}%` }}></div>
                          </div>
                          <span className="text-[11px] font-plex-mono text-instrument-gray">{progressPct}%</span>
                        </div>
                      ) : (
                        <span className="text-fog text-caption">—</span>
                      )}
                    </div>

                    <div className="col-span-8 md:col-span-2 flex items-center justify-end gap-2">
                      {project.status === "UPLOADED" ? (
                        <Link
                          href={`/projects/${project.id}/processing`}
                          className="bg-survey-navy hover:bg-deep-chart text-white text-caption font-medium rounded-[4px] px-3 py-1.5 transition-colors flex items-center gap-1.5"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          Run AI
                        </Link>
                      ) : (
                        <Link
                          href={`/projects/${project.id}`}
                          className="bg-transparent border border-hairline hover:border-survey-navy text-survey-navy text-caption font-medium rounded-[4px] px-3 py-1.5 transition-colors flex items-center gap-1.5 bg-white"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      
                      <button
                        onClick={() => handleDelete(project.id, project.name)}
                        disabled={deletingId === project.id}
                        className="p-1.5 rounded-[4px] text-fog hover:text-conflict-rust hover:bg-rust-wash transition-colors disabled:opacity-50"
                        title="Delete Survey"
                      >
                        <Trash2 className={`h-4 w-4 ${deletingId === project.id ? "animate-pulse text-conflict-rust" : ""}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
