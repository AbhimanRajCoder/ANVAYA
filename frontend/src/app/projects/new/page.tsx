"use client";

import React from "react";
import NewSurveyWizard from "@/components/upload/NewSurveyWizard";
import { PlusCircle } from "lucide-react";

export default function NewProject() {
  return (
    <div className="w-full min-h-screen bg-slate-50 pb-20">
      {/* Header Banner */}
      <div className="bg-ops-gradient w-full border-b border-slate-800 py-10 px-8 shadow-md mb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-blue-400 font-plex-mono text-xs uppercase tracking-wider mb-2 font-semibold">
            <PlusCircle className="h-4 w-4 text-blue-400" />
            Survey Registration Wizard
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create New Cadastral Survey</h1>
          <p className="text-slate-300 text-sm mt-1.5 max-w-xl">
            Provide survey metadata and upload your drone orthomosaic raster to initiate automated AI extraction.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        <NewSurveyWizard />
      </div>
    </div>
  );
}

