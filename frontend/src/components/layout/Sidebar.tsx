"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Cpu,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Map,
  PlusCircle,
  Shield,
  Loader2,
} from "lucide-react";
import { getProject } from "@/lib/api/projects";
import { Project } from "@/types";
import { getProjectStatusLabel, getProjectStatusColor } from "@/lib/projectUtils";

export default function Sidebar() {
  const pathname = usePathname();
  const [project, setProject] = React.useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = React.useState(false);

  // Extract projectId if url matches "/projects/[projectId]"
  const projectMatch = pathname.match(/^\/projects\/([a-zA-Z0-9-]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;
  const isNewProjectPage = pathname === "/projects/new";

  // If inside project view, show project submenu (unless it's the "new project" form)
  const showProjectMenu = projectId && !isNewProjectPage;

  useEffect(() => {
    if (!projectId || isNewProjectPage) {
      setProject(null);
      return;
    }

    let active = true;
    const fetchProj = async () => {
      setLoadingProject(true);
      try {
        const data = await getProject(projectId);
        if (active) {
          setProject(data);
        }
      } catch (err) {
        console.error("Sidebar project fetch failed:", err);
      } finally {
        if (active) setLoadingProject(false);
      }
    };

    fetchProj();
    // Poll project status periodically (every 7 seconds) to sync sidebar badge live
    const interval = setInterval(fetchProj, 7000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [projectId, isNewProjectPage]);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/" || pathname === "/dashboard";
    }
    return pathname === path || pathname.startsWith(path + "/");
  };

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-[4px] text-[14px] font-medium transition-all duration-200 ${
      active
        ? "bg-grid-wash text-survey-navy shadow-xs"
        : "text-slate-blue hover:bg-grid-wash hover:text-survey-navy"
    }`;

  return (
    <aside className="w-[264px] border-r border-hairline bg-paper flex flex-col shrink-0 h-full">
      <div className="flex-1 py-6 px-4 space-y-7 overflow-y-auto">
        {showProjectMenu ? (
          // Inside Project Submenu
          <div className="space-y-6">
            <div>
              <Link
                href="/projects"
                className="flex items-center gap-2 text-caption text-instrument-gray hover:text-survey-navy font-semibold tracking-wider uppercase mb-4"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Surveys
              </Link>
              
              {/* Dynamic Project Meta Info in Sidebar */}
              {project && (
                <div className="mt-2 p-3 bg-white border border-hairline rounded-[6px] space-y-2 shadow-xs">
                  <p className="text-[13px] font-bold text-survey-navy truncate" title={project.name}>
                    {project.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[12px] px-2 py-0.5 rounded-[3px] font-plex-mono font-medium uppercase tracking-wider ${
                        project.status === "COMPLETED" ? "text-verified-green bg-[#e7f4ec]" :
                        project.status === "FAILED" ? "text-conflict-rust bg-rust-wash" :
                        project.status === "UPLOADED" ? "text-instrument-gray bg-grid-wash" :
                        "text-review-amber bg-[#fbf0d9]"
                      }`}
                    >
                      {getProjectStatusLabel(project.status)}
                    </span>
                  </div>
                </div>
              )}
              {!project && loadingProject && (
                <div className="flex items-center gap-2 text-caption text-instrument-gray p-3 bg-white border border-hairline rounded-[6px] shadow-xs">
                  <Loader2 className="h-3 w-3 animate-spin text-instrument-gray" />
                  Loading details...
                </div>
              )}

              <div className="h-[1px] bg-hairline my-4"></div>
            </div>

            <div className="space-y-1">
              <span className="px-4 text-caption font-semibold text-fog uppercase tracking-wider block mb-2">
                Survey Context
              </span>
              <Link
                href={`/projects/${projectId}`}
                className={linkClass(pathname === `/projects/${projectId}`)}
              >
                <FileText className="h-4 w-4" />
                Overview
              </Link>
              <Link
                href={`/projects/${projectId}/processing`}
                className={linkClass(isActive(`/projects/${projectId}/processing`))}
              >
                <Cpu className="h-4 w-4" />
                AI Processing
              </Link>
              <Link
                href={`/projects/${projectId}/map`}
                className={linkClass(isActive(`/projects/${projectId}/map`))}
              >
                <Map className="h-4 w-4" />
                GIS Workspace
              </Link>
              {project?.status === "COMPLETED" && (
                <Link
                  href={`/projects/${projectId}/review`}
                  className={linkClass(isActive(`/projects/${projectId}/review`))}
                >
                  <Shield className="h-4 w-4 text-cadastral-rust" />
                  Human Review
                </Link>
              )}
              <Link
                href={`/projects/${projectId}/results`}
                className={linkClass(isActive(`/projects/${projectId}/results`))}
              >
                <BarChart3 className="h-4 w-4" />
                Results & Export
              </Link>
            </div>
          </div>
        ) : (
          // Global Sidebar Menu
          <div className="space-y-1">
            <span className="px-4 text-caption font-semibold text-fog uppercase tracking-wider block mb-3">
              Navigation
            </span>
            <Link href="/" className={linkClass(isActive("/"))}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link href="/projects" className={linkClass(isActive("/projects") && !isNewProjectPage)}>
              <FolderKanban className="h-4 w-4" />
              Surveys
            </Link>
            <Link href="/projects/new" className={linkClass(isActive("/projects/new"))}>
              <PlusCircle className="h-4 w-4" />
              New Survey
            </Link>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-hairline bg-grid-wash text-center">
        <p className="text-[11px] text-instrument-gray font-plex-mono uppercase tracking-wider">ANVAYA GEOSPATIAL LABS</p>
      </div>
    </aside>
  );
}
