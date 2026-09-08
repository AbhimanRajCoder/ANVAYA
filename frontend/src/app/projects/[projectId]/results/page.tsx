"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject } from "@/lib/api/projects";
import { Project } from "@/types";
import ResultsDashboard from "@/components/projects/ResultsDashboard";
import { Loader2, Database, Map, Download, BarChart3 } from "lucide-react";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
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
        console.error("Failed to load project details for results page:", err);
        setError(err.message || "Failed to load project details.");
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  if (loading) {
    return (
      <div className="w-full flex flex-col min-h-full">
        <div className="bg-white w-full border-b border-hairline pt-10 pb-8 px-8">
          <div className="max-w-[1440px] mx-auto">
            <div className="h-4 w-32 bg-grid-wash rounded animate-pulse mb-3"></div>
            <div className="h-8 w-72 bg-grid-wash rounded animate-pulse"></div>
          </div>
        </div>
        <div className="w-full bg-paper flex-1 py-12 px-8">
          <div className="max-w-[1440px] mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white border border-hairline rounded-[6px] animate-pulse"></div>)}
            </div>
            <div className="h-64 bg-white border border-hairline rounded-[6px] animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-full py-24">
        <Database className="h-10 w-10 text-conflict-rust mb-4" />
        <h2 className="text-body font-semibold text-survey-navy mb-2">Failed to Load Results</h2>
        <p className="text-caption text-instrument-gray max-w-md text-center">
          {error || "Could not retrieve project metadata."}
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 px-6 py-2 bg-survey-navy hover:bg-deep-chart text-white text-[14px] font-medium rounded-[4px] transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white w-full border-b border-hairline pt-10 pb-8 px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-caption text-fog font-plex-mono uppercase tracking-wider block mb-2">
              <BarChart3 className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
              Analytical Report
            </span>
            <h1 className="text-display-sm font-semibold text-survey-navy tracking-display-sm">
              {project.name} — Results
            </h1>
            <p className="text-instrument-gray text-body-sm mt-1">
              Review extracted cadastral features and export validated data.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}/review`)}
              className="flex items-center gap-2 border border-hairline hover:border-survey-navy text-survey-navy px-[16px] py-[10px] rounded-[4px] text-[14px] font-medium transition-colors bg-white"
            >
              <Map className="h-4 w-4" />
              GIS Workspace
            </button>
            <button
              onClick={() => router.push(`/projects/${projectId}/export`)}
              className="flex items-center gap-2 bg-survey-navy hover:bg-deep-chart text-white px-[20px] py-[10px] rounded-[4px] text-[14px] font-medium transition-colors shadow-xs"
            >
              <Download className="h-4 w-4" />
              Export Data
            </button>
          </div>
        </div>
      </div>

      {/* Results Dashboard */}
      <div className="w-full bg-paper flex-1 py-12 px-8">
        <div className="max-w-[1440px] mx-auto">
          <ResultsDashboard project={project} />
        </div>
      </div>
    </div>
  );
}
