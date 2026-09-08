"use client";

import React from "react";
import {
  MousePointer,
  Hand,
  ZoomIn,
  ZoomOut,
  PenTool,
  Move,
  Maximize,
  RotateCw,
  Ruler,
  Maximize2,
  CheckCircle,
  XCircle,
  Square,
  Circle,
  Slash,
  Pentagon,
  Brush,
} from "lucide-react";
import { GISTool } from "@/hooks/useGISEditor";

interface GISToolPaletteProps {
  activeTool: GISTool;
  setActiveTool: (tool: GISTool) => void;
  selectedId: string | null;
  onApprove: () => void;
  onReject: () => void;
  scribbleClass?: "tree" | "road";
  setScribbleClass?: (c: "tree" | "road") => void;
}

export default function GISToolPalette({
  activeTool,
  setActiveTool,
  selectedId,
  onApprove,
  onReject,
  scribbleClass = "tree",
  setScribbleClass = () => {},
}: GISToolPaletteProps) {
  const isSelectionActive = !!selectedId;

  // Tool Definitions
  const tools = [
    {
      group: "Navigation",
      items: [
        { id: "select" as GISTool, icon: <MousePointer className="h-4 w-4" />, label: "Select (V)", shortcut: "V", disabled: false },
        { id: "pan" as GISTool, icon: <Hand className="h-4 w-4" />, label: "Pan (H)", shortcut: "H", disabled: false },
        { id: "zoom_in" as GISTool, icon: <ZoomIn className="h-4 w-4" />, label: "Zoom In", shortcut: "+", disabled: false },
        { id: "zoom_out" as GISTool, icon: <ZoomOut className="h-4 w-4" />, label: "Zoom Out", shortcut: "-", disabled: false },
      ],
    },
    {
      group: "Draw Shapes",
      items: [
        { id: "draw_rect" as GISTool, icon: <Square className="h-4 w-4" />, label: "Draw Rectangle", shortcut: "", disabled: false },
        { id: "draw_poly" as GISTool, icon: <Pentagon className="h-4 w-4" />, label: "Draw Polygon", shortcut: "", disabled: false },
        { id: "draw_line" as GISTool, icon: <Slash className="h-4 w-4" />, label: "Draw Line", shortcut: "", disabled: false },
        { id: "draw_circle" as GISTool, icon: <Circle className="h-4 w-4" />, label: "Draw Circle", shortcut: "", disabled: false },
        { id: "scribble" as GISTool, icon: <Brush className="h-4 w-4" />, label: "Scribble Draw (Auto-shape)", shortcut: "", disabled: false },
      ],
    },
    {
      group: "Geometry Edit",
      items: [
        { id: "vertex_edit" as GISTool, icon: <PenTool className="h-4 w-4" />, label: "Vertex Edit (E)", shortcut: "E", disabled: !isSelectionActive },
        { id: "move" as GISTool, icon: <Move className="h-4 w-4" />, label: "Move Shape (M)", shortcut: "M", disabled: !isSelectionActive },
        { id: "scale" as GISTool, icon: <Maximize className="h-4 w-4" />, label: "Scale Shape (S)", shortcut: "S", disabled: !isSelectionActive },
        { id: "rotate" as GISTool, icon: <RotateCw className="h-4 w-4" />, label: "Rotate Shape (R)", shortcut: "R", disabled: !isSelectionActive },
      ],
    },
    {
      group: "Measurement",
      items: [
        { id: "measure_distance" as GISTool, icon: <Ruler className="h-4 w-4" />, label: "Measure Distance", shortcut: "", disabled: false },
        { id: "measure_area" as GISTool, icon: <Maximize2 className="h-4 w-4" />, label: "Measure Area", shortcut: "", disabled: false },
      ],
    },
  ];

  return (
    <div className="w-10 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-3 gap-3 shrink-0 select-none z-20 text-zinc-300 overflow-y-auto">
      {tools.map((group, gIdx) => (
        <div key={group.group} className="flex flex-col items-center gap-1.5 w-full">
          {gIdx > 0 && <div className="w-6 h-[1px] bg-zinc-800 my-1"></div>}
          
          {group.items.map((tool) => {
            const active = activeTool === tool.id;
            return (
              <div key={tool.id} className="relative group/tooltip">
                <button
                  onClick={() => !tool.disabled && setActiveTool(tool.id)}
                  disabled={tool.disabled}
                  className={`p-2 rounded transition-all ${
                    active
                      ? "bg-zinc-100 text-zinc-950 font-bold"
                      : tool.disabled
                      ? "text-zinc-700 cursor-not-allowed opacity-40"
                      : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {tool.icon}
                </button>

                {/* Micro Tooltip */}
                <div className="absolute left-10 top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] font-medium font-sans px-2 py-1 rounded shadow-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {tool.label}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Scribble Class Switcher Submenu */}
      {activeTool === "scribble" && (
        <div className="flex flex-col items-center gap-1 p-1 bg-zinc-900 border border-zinc-800/80 rounded mt-1.5 shrink-0">
          <button
            onClick={() => setScribbleClass("tree")}
            className={`px-1.5 py-0.5 text-[8px] rounded font-bold font-mono tracking-wider transition-colors uppercase ${
              scribbleClass === "tree" ? "bg-emerald-600 text-white animate-pulse" : "text-zinc-500 hover:text-zinc-350"
            }`}
            title="Scribble to Auto-Fit Tree Circle"
          >
            Tree
          </button>
          <button
            onClick={() => setScribbleClass("road")}
            className={`px-1.5 py-0.5 text-[8px] rounded font-bold font-mono tracking-wider transition-colors uppercase ${
              scribbleClass === "road" ? "bg-yellow-600 text-white animate-pulse" : "text-zinc-500 hover:text-zinc-350"
            }`}
            title="Scribble to Auto-Fit Road Line"
          >
            Road
          </button>
        </div>
      )}

      {/* Review Actions Shortcuts */}
      <div className="w-6 h-[1px] bg-zinc-800 my-1"></div>
      <div className="flex flex-col items-center gap-1.5 w-full">
        {/* Approve */}
        <div className="relative group/tooltip">
          <button
            onClick={onApprove}
            disabled={!isSelectionActive}
            className={`p-2 rounded transition-all ${
              isSelectionActive
                ? "hover:bg-emerald-950 hover:text-emerald-400 text-emerald-600"
                : "text-zinc-700 cursor-not-allowed opacity-40"
            }`}
            title="Approve Shape (A)"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
          <div className="absolute left-10 top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] font-medium px-2 py-1 rounded shadow-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
            Approve (A)
          </div>
        </div>

        {/* Reject */}
        <div className="relative group/tooltip">
          <button
            onClick={onReject}
            disabled={!isSelectionActive}
            className={`p-2 rounded transition-all ${
              isSelectionActive
                ? "hover:bg-red-950 hover:text-red-400 text-red-600"
                : "text-zinc-700 cursor-not-allowed opacity-40"
            }`}
            title="Reject Shape (X)"
          >
            <XCircle className="h-4 w-4" />
          </button>
          <div className="absolute left-10 top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] font-medium px-2 py-1 rounded shadow-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
            Reject (X)
          </div>
        </div>
      </div>
    </div>
  );
}
