"use client";

import React from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import {
  Calendar,
  Cpu,
  Database,
  ExternalLink,
  Map,
  Play,
  PlusCircle,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Sparkles,
} from "lucide-react";

export default function Projects() {
  const { projects, loading, error, refreshProjects } = useProjects();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "COMPLETED" && p.status === "COMPLETED") ||
      (statusFilter === "UPLOADED" && p.status === "UPLOADED") ||
      (statusFilter === "PROCESSING" && p.status !== "COMPLETED" && p.status !== "UPLOADED" && p.status !== "FAILED") ||
      (statusFilter === "FAILED" && p.status === "FAILED");

    return matchesSearch && matchesStatus;
  });

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
    <div className="w-full flex flex-col min-h-screen bg-slate-50 pb-24">
      {/* Sleek Header Banner */}
      <div className="bg-ops-gradient w-full relative border-b border-slate-800 py-12 px-8 shadow-md">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-blue-400 font-plex-mono text-caption uppercase tracking-wider mb-2 font-semibold">
              <Layers className="h-4 w-4" />
              Cadastral Registry Index
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">Drone Survey Projects</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Browse, filter, and manage registered cadastral map survey records and trigger AI feature extraction pipelines.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refreshProjects}
              className="bg-white/10 hover:bg-white/20 text-white text-[13px] font-medium rounded-md px-4 py-2 transition-all backdrop-blur-sm flex items-center gap-2 border border-white/10"
              title="Refresh List"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <Link
              href="/projects/new"
              className="bg-cadastral-rust hover:bg-[#a84417] text-white text-[13px] font-medium rounded-md px-5 py-2 transition-all shadow-sm flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              New Survey
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto w-full px-8 pt-8 space-y-6">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          {/* Search Box */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 w-full md:w-80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="h-4 w-4 text-slate-400 mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Search by survey name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-slate-800 text-sm focus:outline-none w-full placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "ALL", label: "All Surveys" },
              { id: "COMPLETED", label: "Verified" },
              { id: "UPLOADED", label: "Pending AI" },
              { id: "PROCESSING", label: "In Review" },
              { id: "FAILED", label: "Conflicts" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium font-plex-mono transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? "bg-survey-navy text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 flex flex-col gap-3 max-w-2xl">
            <p className="text-sm font-medium">Failed to load surveys:</p>
            <p className="text-xs bg-white p-3 rounded-lg border border-slate-200 font-plex-mono text-slate-800">
              {error}
            </p>
            <button
              onClick={refreshProjects}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium py-2 px-4 rounded-lg self-start transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-xl p-5 h-[230px] flex flex-col justify-between animate-pulse shadow-sm"
              >
                <div className="space-y-3">
                  <div className="h-5 w-40 bg-slate-100 rounded"></div>
                  <div className="h-3.5 w-full bg-slate-100 rounded"></div>
                  <div className="h-3.5 w-4/5 bg-slate-100 rounded"></div>
                </div>
                <div className="h-9 w-full bg-slate-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-500 max-w-2xl mx-auto flex flex-col items-center gap-4 shadow-sm my-8">
            <Database className="h-10 w-10 text-slate-300" />
            <h3 className="font-semibold text-slate-900 text-lg">No survey projects found</h3>
            <p className="text-sm text-slate-500 max-w-md">
              {searchQuery || statusFilter !== "ALL"
                ? `No surveys match your search query or status filter. Try clearing your filters.`
                : "You have not registered any drone surveys in the database yet. Upload your first GeoTIFF raster to begin."}
            </p>
            {searchQuery || statusFilter !== "ALL" ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Reset Filters
              </button>
            ) : (
              <Link
                href="/projects/new"
                className="mt-2 bg-survey-navy hover:bg-slate-800 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-all shadow-sm flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Upload First Survey
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 flex flex-col justify-between hover:shadow-md transition-all shadow-sm group"
              >
                {/* Top Meta info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-bold text-slate-900 text-base leading-snug group-hover:text-blue-600 transition-colors line-clamp-1 truncate"
                    >
                      {project.name}
                    </Link>
                    <div className="shrink-0">{getStatusBadge(project.status)}</div>
                  </div>
                  <p className="text-slate-500 text-xs line-clamp-2 min-h-[2.25rem] leading-relaxed">
                    {project.description || "No survey description provided."}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 font-plex-mono text-slate-600">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                    {project.crs && (
                      <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-plex-mono text-slate-600">
                        {project.crs}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar for running states */}
                {project.status !== "COMPLETED" && project.status !== "FAILED" && project.status !== "UPLOADED" ? (
                  <div className="mt-4 mb-4">
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5 font-medium font-plex-mono">
                      <span>Processing AI pipeline...</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-survey-navy h-full rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="h-4"></div>
                )}

                {/* Actions Section */}
                <div className="grid grid-cols-2 gap-2 mt-auto pt-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 py-2 px-3 rounded-lg text-xs font-semibold transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    Overview
                  </Link>

                  {project.status === "COMPLETED" ? (
                    <Link
                      href={`/projects/${project.id}/map`}
                      className="flex items-center justify-center gap-1.5 bg-survey-navy hover:bg-slate-800 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-all shadow-sm"
                    >
                      <Map className="h-3.5 w-3.5 text-white/80" />
                      GIS Map
                    </Link>
                  ) : project.status === "UPLOADED" ? (
                    <Link
                      href={`/projects/${project.id}/processing`}
                      className="flex items-center justify-center gap-1.5 bg-cadastral-rust hover:bg-[#a84417] text-white py-2 px-3 rounded-lg text-xs font-semibold transition-all shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5 fill-current text-white/80" />
                      Run AI
                    </Link>
                  ) : project.status === "FAILED" ? (
                    <Link
                      href={`/projects/${project.id}/processing`}
                      className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 px-3 rounded-lg text-xs font-semibold transition-all"
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      Retry
                    </Link>
                  ) : (
                    <Link
                      href={`/projects/${project.id}/processing`}
                      className="flex items-center justify-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 py-2 px-3 rounded-lg text-xs font-semibold transition-all"
                    >
                      <Cpu className="h-3.5 w-3.5 animate-spin" />
                      Monitor
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

