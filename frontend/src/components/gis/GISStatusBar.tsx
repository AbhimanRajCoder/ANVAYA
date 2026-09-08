"use client";

import React from "react";
import { MousePointer, CheckCircle, Loader2, AlertTriangle, HelpCircle } from "lucide-react";
import { SaveState } from "@/hooks/useGISEditor";

interface GISStatusBarProps {
  cursorCoords: { lng: number; lat: number } | null;
  zoom: number;
  selectedId: string | null;
  totalFeatures: number;
  saveState: SaveState;
  activeTool: string;
}

export default function GISStatusBar({
  cursorCoords,
  zoom,
  selectedId,
  totalFeatures,
  saveState,
  activeTool,
}: GISStatusBarProps) {
  const getSaveBadge = () => {
    switch (saveState) {
      case "saving":
        return <span className="text-zinc-400">Saving...</span>;
      case "error":
        return <span className="text-red-500 font-bold">Error Saving</span>;
      case "unsaved":
        return <span className="text-amber-500 font-bold">Unsaved changes</span>;
      case "saved":
      default:
        return <span className="text-emerald-500">Saved</span>;
    }
  };

  const formatCoords = () => {
    if (!cursorCoords) return "Cursor Outside Bounds";
    return `${cursorCoords.lng.toFixed(6)}°, ${cursorCoords.lat.toFixed(6)}°`;
  };

  const getToolName = (tool: string) => {
    switch (tool) {
      case "select":
        return "Select Tool (V)";
      case "pan":
        return "Pan Map (H)";
      case "vertex_edit":
        return "Vertex Editor (E)";
      case "move":
        return "Move Shape (M)";
      case "scale":
        return "Scale Shape (S)";
      case "rotate":
        return "Rotate Shape (R)";
      case "measure_distance":
        return "Measure Distance";
      case "measure_area":
        return "Measure Area";
      default:
        return tool;
    }
  };

  return (
    <div className="h-6 bg-zinc-950 border-t border-zinc-800 px-4 flex items-center justify-between shrink-0 select-none text-[10px] font-mono text-zinc-400 z-30 relative">
      {/* Tool & Cursor */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-zinc-300">
          <MousePointer className="h-3 w-3 text-indigo-400" />
          <span>{getToolName(activeTool)}</span>
        </div>
        <div className="h-3 w-[1px] bg-zinc-850"></div>
        <div className="text-zinc-400">
          {formatCoords()}
        </div>
      </div>

      {/* Target & Project Metrics */}
      <div className="flex items-center gap-4">
        {selectedId ? (
          <div className="text-zinc-300">
            Selected: <span className="font-bold text-indigo-400 select-all font-mono">B-{selectedId.slice(0, 8)}</span>
          </div>
        ) : (
          <div className="text-zinc-500">No Selection</div>
        )}
        <div className="h-3 w-[1px] bg-zinc-850"></div>
        <div>
          Total: <span className="font-bold text-zinc-200">{totalFeatures} Polygons</span>
        </div>
      </div>

      {/* Grid Reference & State */}
      <div className="flex items-center gap-4">
        <div>
          CRS: <span className="text-zinc-300 font-semibold">EPSG:4326 (WGS84)</span>
        </div>
        <div className="h-3 w-[1px] bg-zinc-850"></div>
        <div>
          Zoom: <span className="text-zinc-300 font-semibold">{zoom.toFixed(1)}</span>
        </div>
        <div className="h-3 w-[1px] bg-zinc-850"></div>
        <div className="flex items-center gap-1.5 uppercase font-bold text-[9px] tracking-wider">
          {getSaveBadge()}
        </div>
      </div>
    </div>
  );
}
