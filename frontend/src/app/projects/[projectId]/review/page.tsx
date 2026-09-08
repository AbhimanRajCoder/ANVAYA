"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { getProject } from "@/lib/api/projects";
import { Project } from "@/types";
import { Loader2, Database } from "lucide-react";

// Dynamically import GISWorkspace to disable Server-Side Rendering (SSR)
// MapLibre GL JS accesses window and document on import, which throws errors in Next.js SSR build
const GISWorkspace = dynamic(() => import("@/components/gis/GISWorkspace"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400">
      <Loader2 className="h-6 w-6 text-survey-navy animate-spin" />
      <span className="text-instrument-gray text-caption font-plex-mono uppercase tracking-wider">
        Initializing GIS Workspace...
      </span>
    </div>
  ),
});

export default function HumanReviewPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProj = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProject(projectId);
        setProject(data);
      } catch (err: any) {
        console.error("Failed to load project details for GIS workspace:", err);
        setError(err.message || "Failed to load project details.");
      } finally {
        setLoading(false);
      }
    };
    fetchProj();
  }, [projectId]);

  if (loading) {
    return (
      <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="h-6 w-6 text-survey-navy animate-spin" />
        <span className="text-instrument-gray text-caption font-plex-mono uppercase tracking-wider">
          Reading orthomosaic metadata...
        </span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-full w-full bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm bg-white border border-hairline p-8 rounded-[6px] shadow-xs">
          <Database className="h-10 w-10 text-conflict-rust mx-auto" />
          <h2 className="text-body font-semibold text-survey-navy">Workspace Load Failed</h2>
          <p className="text-caption text-instrument-gray leading-relaxed">
            {error || "Could not retrieve project bounding coordinates."}
          </p>
        </div>
      </div>
    );
  }

  return <GISWorkspace project={project} />;
}
