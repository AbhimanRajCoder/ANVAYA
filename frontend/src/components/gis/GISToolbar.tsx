"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Undo,
  Redo,
  RefreshCw,
  Eye,
  Maximize2,
  Download,
  FolderClosed,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown
} from "lucide-react";
import { SaveState } from "@/hooks/useGISEditor";
import { getExportUrl } from "@/lib/api/buildings";

interface GISToolbarProps {
  projectName: string;
  projectId: string;
  saveState: SaveState;
  onSave: () => void;
  onSaveAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReset: () => void;
  compareMode: boolean;
  setCompareMode: (val: boolean) => void;
  onFitSurvey: () => void;
  onFitSelection: () => void;
  hasUnsaved: boolean;
}

export default function GISToolbar({
  projectName,
  projectId,
  saveState,
  onSave,
  onSaveAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onReset,
  compareMode,
  setCompareMode,
  onFitSurvey,
  onFitSelection,
  hasUnsaved,
}: GISToolbarProps) {
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);

  const getSaveStateBadge = () => {
    switch (saveState) {
      case "saving":
        return (
          <span className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px] uppercase">
            <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
            Saving...
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1.5 text-red-500 font-mono text-[11px] uppercase font-semibold">
            <XCircle className="h-3 w-3" />
            Save Failed
          </span>
        );
      case "unsaved":
        return (
          <span className="flex items-center gap-1.5 text-amber-500 font-mono text-[11px] uppercase font-semibold animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            Unsaved Changes
          </span>
        );
      case "saved":
      default:
        return (
          <span className="flex items-center gap-1.5 text-emerald-500 font-mono text-[11px] uppercase">
            <CheckCircle className="h-3.5 w-3.5" />
            Saved
          </span>
        );
    }
  };

  const handleExport = (format: "geojson" | "shp" | "gpkg") => {
    setExportOpen(false);
    const url = getExportUrl(projectId, format);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("target", "_blank");
    link.click();
  };

  return (
    <div className="h-12 bg-zinc-950 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0 select-none z-30 relative text-zinc-200">
      {/* 1. Project Title & Exit */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white px-2 py-1.5 rounded transition-colors text-xs font-medium"
          title="Return to survey detail dashboard"
        >
          <FolderClosed className="h-4 w-4" />
          Exit
        </button>
        <div className="h-4 w-[1px] bg-zinc-800"></div>
        <span className="text-xs font-bold font-mono text-zinc-100 max-w-[200px] truncate" title={projectName}>
          {projectName}
        </span>
      </div>

      {/* 2. Operations Group */}
      <div className="flex items-center gap-1.5">
        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-1.5 rounded transition-colors ${
            canUndo ? "hover:bg-zinc-800 text-zinc-200" : "text-zinc-600 cursor-not-allowed"
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-1.5 rounded transition-colors ${
            canRedo ? "hover:bg-zinc-800 text-zinc-200" : "text-zinc-600 cursor-not-allowed"
          }`}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1"></div>

        {/* Save / Save All */}
        <button
          onClick={onSave}
          disabled={saveState === "saving" || !hasUnsaved}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
            hasUnsaved
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              : "bg-zinc-900 text-zinc-500 cursor-not-allowed"
          }`}
          title="Save active building changes (Ctrl+S)"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
        <button
          onClick={onSaveAll}
          disabled={saveState === "saving" || !hasUnsaved}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
            hasUnsaved
              ? "border border-zinc-700 hover:bg-zinc-800 text-zinc-200"
              : "text-zinc-500 cursor-not-allowed"
          }`}
          title="Save all pending changes"
        >
          Save All
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 border border-zinc-850 hover:bg-zinc-800 text-zinc-300 px-2.5 py-1.5 rounded text-xs font-medium transition-colors"
          title="Reset active shape to AI original boundaries"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset to AI
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1"></div>

        {/* Compare Toggle */}
        <button
          onClick={() => setCompareMode(!compareMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
            compareMode
              ? "bg-zinc-200 text-zinc-950 font-bold"
              : "border border-zinc-700 hover:bg-zinc-800 text-zinc-300"
          }`}
          title="Overlay original AI geometry with human changes"
        >
          <Eye className="h-3.5 w-3.5" />
          Compare AI vs Edited
        </button>
      </div>

      {/* 3. Viewport & Export Group */}
      <div className="flex items-center gap-2">
        {/* Save State Badge */}
        <div className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-850 flex items-center justify-center mr-2">
          {getSaveStateBadge()}
        </div>

        {/* Fit Views */}
        <button
          onClick={onFitSurvey}
          className="px-2.5 py-1.5 rounded border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
          title="Zoom to TIFF bounds"
        >
          Fit Survey
        </button>
        <button
          onClick={onFitSelection}
          className="px-2.5 py-1.5 rounded border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
          title="Zoom to selected building"
        >
          Fit Selection
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export
            <ChevronDown className="h-3 w-3" />
          </button>

          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)}></div>
              <div className="absolute right-0 mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded shadow-xl py-1 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                <button
                  onClick={() => handleExport("geojson")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors font-medium"
                >
                  Validated GeoJSON
                </button>
                <button
                  onClick={() => handleExport("shp")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors font-medium"
                >
                  ESRI Shapefile (.zip)
                </button>
                <button
                  onClick={() => handleExport("gpkg")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors font-medium"
                >
                  GeoPackage (.gpkg)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
