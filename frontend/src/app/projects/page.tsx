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
} from "lucide-react";

export default function Projects() {
  const { projects, loading, error, refreshProjects } = useProjects();
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
    <div className="w-full flex flex-col min-h-screen bg-paper pb-24">
      {/* Page Header */}
      <div className="bg-survey-navy w-full relative border-b border-hairline overflow-hidden pt-[64px] pb-[64px] px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-display-sm font-semibold text-white tracking-display-sm">Drone Surveys</h1>
            <p className="text-fog mt-2 text-body">
              Manage your cadastral map survey records and trigger feature extraction pipelines.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refreshProjects}
              className="flex items-center justify-center p-2 rounded-[4px] border border-hairline/20 bg-deep-chart hover:bg-slate-blue text-white transition-colors"
              title="Refresh List"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link
              href="/projects/new"
              className="bg-white text-survey-navy hover:bg-grid-wash px-[20px] py-[8px] rounded-[4px] text-body-sm font-medium transition-colors shadow-xs flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              New Survey
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto w-full px-8 pt-8 space-y-8">
        {/* Search & Filter Bar */}
        <div className="flex items-center bg-white border border-hairline rounded-[4px] px-3 py-2 w-full md:w-96 shadow-xs">
          <Search className="h-4 w-4 text-instrument-gray mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search by survey name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-survey-navy text-body-sm focus:outline-none w-full placeholder:text-fog"
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-rust-wash border border-conflict-rust/30 p-4 rounded-[6px] text-conflict-rust flex flex-col gap-3 max-w-2xl">
            <p className="text-body-sm font-medium">Failed to load surveys:</p>
            <p className="text-caption bg-white p-3 rounded-[4px] border border-hairline font-plex-mono text-survey-navy">
              {error}
            </p>
            <button
              onClick={refreshProjects}
              className="text-body-sm bg-conflict-rust hover:bg-[#8c3116] text-white font-medium py-[8px] px-[16px] rounded-[4px] self-start"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Projects List/Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white border border-hairline rounded-[6px] p-4 h-[220px] flex flex-col justify-between animate-pulse"
              >
                <div className="space-y-3">
                  <div className="h-5 w-40 bg-grid-wash rounded-[4px]"></div>
                  <div className="h-3 w-full bg-grid-wash rounded-[4px]"></div>
                  <div className="h-3 w-4/5 bg-grid-wash rounded-[4px]"></div>
                </div>
                <div className="h-[36px] w-full bg-grid-wash rounded-[4px]"></div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white border border-hairline rounded-[6px] p-16 text-center text-instrument-gray max-w-2xl mx-auto flex flex-col items-center gap-4 shadow-xs">
            <Database className="h-8 w-8 text-fog" />
            <h3 className="font-semibold text-survey-navy text-heading-sm">No survey projects found</h3>
            <p className="text-body text-instrument-gray max-w-md">
              {searchQuery
                ? `No surveys match your query: "${searchQuery}". Try editing the spelling or adding a new survey.`
                : "You have not registered any drone surveys in the database yet. Click below to upload your first GeoTIFF."}
            </p>
            {!searchQuery && (
              <Link
                href="/projects/new"
                className="mt-2 bg-survey-navy hover:bg-deep-chart text-white font-medium py-[10px] px-[20px] rounded-[4px] text-body-sm transition-colors shadow-xs"
              >
                Upload Survey
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white border border-hairline rounded-[6px] p-[16px] flex flex-col justify-between hover:shadow-sm transition-all shadow-xs"
              >
                {/* Top Meta info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-survey-navy text-subheading leading-snug line-clamp-1 truncate">
                      {project.name}
                    </h3>
                    <div className="shrink-0">{getStatusBadge(project.status)}</div>
                  </div>
                  <p className="text-instrument-gray text-body-sm line-clamp-2 min-h-[2.5rem]">
                    {project.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between text-caption text-instrument-gray mt-2 pt-2 border-t border-hairline">
                    <span className="flex items-center gap-1.5 font-plex-mono text-data-mono">
                      <Calendar className="h-3.5 w-3.5 text-fog" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                    {project.crs && (
                      <span className="bg-paper border border-hairline px-1.5 py-0.5 rounded-[3px] font-plex-mono text-[11px] text-instrument-gray">
                        {project.crs}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar for running states */}
                {project.status !== "COMPLETED" && project.status !== "FAILED" && project.status !== "UPLOADED" ? (
                  <div className="mt-4 mb-4">
                    <div className="flex justify-between items-center text-caption text-instrument-gray mb-1.5 font-medium">
                      <span>Processing...</span>
                      <span className="font-plex-mono">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-grid-wash h-[4px] rounded-full overflow-hidden">
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
                    className="flex items-center justify-center gap-1.5 bg-transparent border border-hairline hover:bg-grid-wash text-survey-navy py-[8px] px-3 rounded-[4px] text-body-sm font-medium transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-slate-blue" />
                    Overview
                  </Link>

                  {project.status === "COMPLETED" ? (
                    <Link
                      href={`/projects/${project.id}/map`}
                      className="flex items-center justify-center gap-1.5 bg-survey-navy hover:bg-deep-chart text-white py-[8px] px-3 rounded-[4px] text-body-sm font-medium transition-colors shadow-xs"
                    >
                      <Map className="h-3.5 w-3.5 text-white/80" />
                      GIS Map
                    </Link>
                  ) : project.status === "UPLOADED" ? (
                    <Link
                      href={`/projects/${project.id}/processing`}
                      className="flex items-center justify-center gap-1.5 bg-survey-navy hover:bg-deep-chart text-white py-[8px] px-3 rounded-[4px] text-body-sm font-medium transition-colors shadow-xs"
                    >
                      <Play className="h-3.5 w-3.5 fill-current text-white/80" />
                      Run AI
                    </Link>
                  ) : project.status === "FAILED" ? (
                    <Link
                      href={`/projects/${project.id}/processing`}
                      className="flex items-center justify-center gap-1.5 bg-white hover:bg-rust-wash text-conflict-rust border border-conflict-rust/30 py-[8px] px-3 rounded-[4px] text-body-sm font-medium transition-colors"
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      Retry
                    </Link>
                  ) : (
                    <Link
                      href={`/projects/${project.id}/processing`}
                      className="flex items-center justify-center gap-1.5 bg-[#fbf0d9] border border-review-amber/30 text-review-amber py-[8px] px-3 rounded-[4px] text-body-sm font-medium transition-colors"
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
