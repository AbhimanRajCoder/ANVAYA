"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { getProject } from "@/lib/api/projects";
import { Project } from "@/types";
import { Loader2, Database } from "lucide-react";

// Dynamically import GISWorkspace to disable server-side rendering (SSR)
// This is critical since MapLibre GL JS accesses window and document on import.
const GISWorkspace = dynamic(() => import("@/components/gis/GISWorkspace"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400">
      <Loader2 className="h-5 w-5 text-survey-navy animate-spin" />
      <span className="text-instrument-gray text-xs font-semibold font-plex-mono uppercase tracking-wider">Initializing WebGL engine...</span>
    </div>
  ),
});

export default function MapPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProject(projectId);
        setProject(data);
      } catch (err: any) {
        console.error("Failed to load project details for GIS map:", err);
        setError(err.message || "Failed to load project details.");
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex-1 h-[calc(100vh-8rem)] bg-paper flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 text-survey-navy animate-spin" />
        <span className="text-instrument-gray text-xs font-semibold">Loading survey metadata...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex-1 h-[calc(100vh-8rem)] bg-paper flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm bg-white border border-hairline p-8 rounded-[6px] shadow-xs">
          <Database className="h-10 w-10 text-conflict-rust mx-auto" />
          <h2 className="text-sm font-bold text-survey-navy uppercase tracking-wider">Failed to Load Map</h2>
          <p className="text-xs text-instrument-gray leading-normal">
            {error || "Could not retrieve project bounding coordinates."}
          </p>
        </div>
      </div>
    );
  }

  return <GISWorkspace project={project} />;
}
