"use client";

import React from "react";
import NewSurveyWizard from "@/components/upload/NewSurveyWizard";

export default function NewProject() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Create New Survey</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Provide metadata details and upload a drone orthomosaic image to register a mapping survey.
        </p>
      </div>

      <NewSurveyWizard />
    </div>
  );
}
