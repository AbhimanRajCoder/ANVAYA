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
  RefreshCw,
  Building2,
  Activity,
  CheckCircle2,
  Clock,
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
        return <span className="inline-flex items-center gap-1.5 text-[#166534] bg-[#dcfce7] border border-[#bbf7d0] px-2.5 py-1 rounded-md text-[11px] font-plex-mono font-semibold uppercase tracking-wider">VERIFIED</span>;
      case "FAILED":
        return <span className="inline-flex items-center gap-1.5 text-[#991b1b] bg-[#fee2e2] border border-[#fecaca] px-2.5 py-1 rounded-md text-[11px] font-plex-mono font-semibold uppercase tracking-wider">CONFLICT</span>;
      case "UPLOADED":
        return <span className="inline-flex items-center gap-1.5 text-[#475569] bg-[#f1f5f9] border border-[#e2e8f0] px-2.5 py-1 rounded-md text-[11px] font-plex-mono font-semibold uppercase tracking-wider">PENDING</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 text-[#854d0e] bg-[#fef9c3] border border-[#fef08a] px-2.5 py-1 rounded-md text-[11px] font-plex-mono font-semibold uppercase tracking-wider">REVIEW</span>;
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen bg-slate-50">
      {/* Sleek Ops Header Banner without grid pattern */}
      <div className="bg-ops-gradient w-full relative border-b border-slate-800 py-12 px-8 shadow-md">
        <div className="max-w-[1440px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                Cadastral Registry & Overview
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshProjects}
                className="bg-white/10 hover:bg-white/20 text-white text-[13px] font-medium rounded-md px-4 py-2 transition-all backdrop-blur-sm flex items-center gap-2 border border-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sync Registry
              </button>
              <Link
                href="/projects/new"
                className="bg-cadastral-rust hover:bg-[#a84417] text-white text-[13px] font-medium rounded-md px-5 py-2 transition-all shadow-sm flex items-center gap-2 font-medium"
              >
                <PlusCircle className="h-4 w-4" />
                New Survey
              </Link>
            </div>
          </div>
          
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm hover:bg-white/10 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-caption font-semibold uppercase tracking-wider font-plex-mono">
                <span>Total Surveys</span>
                <Layers className="h-4 w-4 text-blue-400" />
              </div>
              <div className="mt-4">
                {loading ? (
                  <div className="h-10 w-24 bg-white/10 rounded animate-pulse"></div>
                ) : (
                  <span className="text-3xl xl:text-4xl font-bold font-plex-mono text-white tracking-tight">
                    {projects.length}
                  </span>
                )}
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm hover:bg-white/10 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-caption font-semibold uppercase tracking-wider font-plex-mono">
                <span>Completed Surveys</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-4">
                {loading ? (
                  <div className="h-10 w-24 bg-white/10 rounded animate-pulse"></div>
                ) : (
                  <span className="text-3xl xl:text-4xl font-bold font-plex-mono text-emerald-400 tracking-tight">
                    {projects.filter((p) => p.status === "COMPLETED").length}
                  </span>
                )}
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm hover:bg-white/10 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-caption font-semibold uppercase tracking-wider font-plex-mono">
                <span>Structures Detected</span>
                <Building2 className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-4">
                {loading || loadingStats ? (
                  <div className="h-10 w-24 bg-white/10 rounded animate-pulse"></div>
                ) : (
                  <span className="text-3xl xl:text-4xl font-bold font-plex-mono text-white tracking-tight">
                    {totalBuildings.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm hover:bg-white/10 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-caption font-semibold uppercase tracking-wider font-plex-mono">
                <span>Mapped Area</span>
                <MapPin className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-4">
                {loading || loadingStats ? (
                  <div className="h-10 w-32 bg-white/10 rounded animate-pulse"></div>
                ) : (
                  <span className="text-3xl xl:text-4xl font-bold font-plex-mono text-white tracking-tight">
                    {calculateTotalArea()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Operations Canvas */}
      <div className="w-full flex-1 py-10 px-8">
        <div className="max-w-[1440px] mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Active Surveys</h2>
              <p className="text-slate-500 text-sm mt-0.5">Manage, process, and review registered cadastral survey datasets.</p>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="bg-slate-50 grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 font-plex-mono tracking-wider">
              <div className="col-span-4 md:col-span-3">Survey Name</div>
              <div className="col-span-2 hidden md:block">Status</div>
              <div className="col-span-2 hidden md:block">Created Date</div>
              <div className="col-span-2 hidden md:block md:col-span-1">Features</div>
              <div className="col-span-2 hidden md:block">Human Review</div>
              <div className="col-span-8 md:col-span-2 text-right">Actions</div>
            </div>

            {loading ? (
              <div className="divide-y divide-slate-100">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 animate-pulse items-center">
                    <div className="col-span-4 md:col-span-3 h-4 bg-slate-100 rounded w-3/4"></div>
                    <div className="col-span-2 hidden md:block h-4 bg-slate-100 rounded w-16"></div>
                    <div className="col-span-2 hidden md:block h-4 bg-slate-100 rounded w-24"></div>
                    <div className="col-span-2 hidden md:block h-4 bg-slate-100 rounded w-16"></div>
                    <div className="col-span-2 hidden md:block h-4 bg-slate-100 rounded w-16"></div>
                    <div className="col-span-8 md:col-span-2 h-8 bg-slate-100 rounded justify-self-end w-24"></div>
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="py-20 px-6 text-center flex flex-col items-center gap-3">
                <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                  <Layers className="h-8 w-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">No surveys registered yet</h3>
                <p className="text-slate-500 text-sm max-w-sm">
                  Upload your drone orthomosaic imagery to begin automated building extraction and review.
                </p>
                <Link
                  href="/projects/new"
                  className="mt-2 bg-survey-navy hover:bg-slate-800 text-white font-medium py-2 px-5 rounded-lg text-sm transition-all shadow-sm flex items-center gap-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  Upload First Survey
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {projects.map((project) => {
                  const stats = projectStats[project.id];
                  const progressPct = stats?.total ? Math.round((stats.reviewed / stats.total) * 100) : 0;
                  
                  return (
                    <div
                      key={project.id}
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="col-span-4 md:col-span-3 flex flex-col gap-0.5 pr-4">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 text-sm truncate transition-colors"
                        >
                          {project.name}
                        </Link>
                        <span className="text-[11px] text-slate-400 font-plex-mono truncate">
                          ID: {project.id.slice(0, 18)}...
                        </span>
                      </div>

                      <div className="col-span-2 hidden md:flex items-center">
                        {getStatusBadge(project.status)}
                      </div>

                      <div className="col-span-2 hidden md:flex items-center text-xs font-plex-mono text-slate-600">
                        {new Date(project.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>

                      <div className="col-span-2 hidden md:flex md:col-span-1 items-center">
                        {project.status === "COMPLETED" ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-plex-mono font-medium text-slate-700">
                            {stats?.total || 0} units
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </div>

                      <div className="col-span-2 hidden md:flex items-center">
                        {project.status === "COMPLETED" ? (
                          <div className="flex items-center gap-2.5 w-full pr-4">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }}></div>
                            </div>
                            <span className="text-xs font-plex-mono font-medium text-slate-600">{progressPct}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </div>

                      <div className="col-span-8 md:col-span-2 flex items-center justify-end gap-2">
                        {project.status === "UPLOADED" ? (
                          <Link
                            href={`/projects/${project.id}/processing`}
                            className="bg-survey-navy hover:bg-slate-800 text-white text-xs font-medium rounded-lg px-3.5 py-2 transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            Run AI
                          </Link>
                        ) : (
                          <Link
                            href={`/projects/${project.id}`}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg px-3.5 py-2 transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            Open
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </Link>
                        )}
                        
                        <button
                          onClick={() => handleDelete(project.id, project.name)}
                          disabled={deletingId === project.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-50"
                          title="Delete Survey"
                        >
                          <Trash2 className={`h-4 w-4 ${deletingId === project.id ? "animate-pulse text-rose-600" : ""}`} />
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

