"use client";

import React, { useMemo, useState } from "react";
import { GeoJSONFeature } from "@/types";
import { ListCollapse, ChevronRight, Sliders, AlertTriangle } from "lucide-react";

interface GISReviewQueueProps {
  features: GeoJSONFeature[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  confidenceThreshold: number;
  setConfidenceThreshold: (val: number) => void;
}

export default function GISReviewQueue({
  features,
  selectedId,
  onSelect,
  confidenceThreshold,
  setConfidenceThreshold,
}: GISReviewQueueProps) {
  const [sortKey, setSortKey] = useState<"confidence" | "area-desc" | "area-asc">("confidence");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter features that need review (review_status == 'needs_review' or not reviewed yet)
  const queueItems = useMemo(() => {
    return features
      .filter((f) => {
        const status = f.properties.review_status || "needs_review";
        const isReviewed = ["APPROVED", "approved", "EDITED", "edited", "REJECTED", "rejected"].includes(status);
        const conf = f.properties.confidence || 0;
        return conf < confidenceThreshold && !isReviewed;
      })
      .sort((a, b) => {
        if (sortKey === "area-desc") {
          return (b.properties.area || 0) - (a.properties.area || 0);
        }
        if (sortKey === "area-asc") {
          return (a.properties.area || 0) - (b.properties.area || 0);
        }
        return (a.properties.confidence || 0) - (b.properties.confidence || 0);
      });
  }, [features, confidenceThreshold, sortKey]);

  return (
    <div className="w-80 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0 select-none z-10 text-zinc-300">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListCollapse className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-bold font-mono tracking-wider uppercase">Review Queue</span>
          <span className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded font-bold font-mono text-amber-500 border border-amber-900/30">
            {queueItems.length}
          </span>
        </div>
      </div>

      {/* Threshold and Sort controls */}
      <div className="p-4 border-b border-zinc-900 space-y-4">
        {/* Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono text-zinc-400">
            <span className="flex items-center gap-1">
              <Sliders className="h-3 w-3" /> QA Threshold
            </span>
            <span className="font-bold text-zinc-200">{Math.round(confidenceThreshold * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.4"
            max="0.95"
            step="0.05"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Sort Select */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block">Sort Order</span>
          <select
            value={sortKey}
            onChange={(e: any) => setSortKey(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="confidence">Lowest Confidence First</option>
            <option value="area-desc">Largest Built-up Area</option>
            <option value="area-asc">Smallest Built-up Area</option>
          </select>
        </div>
      </div>

      {/* Queue list container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-plex-mono">
        {queueItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-600 gap-2 h-48">
            <AlertTriangle className="h-5 w-5 text-zinc-700" />
            <span className="text-xs font-semibold">Queue Empty</span>
            <span className="text-[10px] leading-normal">All uncertainty targets processed.</span>
          </div>
        ) : (
          queueItems.map((feature, idx) => {
            const bid = feature.properties.building_id;
            const active = selectedId === bid;
            const shortId = bid.slice(0, 8);
            const conf = Math.round(feature.properties.confidence * 100);

            return (
              <button
                key={bid}
                onClick={() => onSelect(bid)}
                className={`w-full flex items-center justify-between p-2 rounded text-left transition-all ${
                  active
                    ? "bg-zinc-800 border-l-2 border-indigo-500 text-white font-bold"
                    : "hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[10px] text-zinc-600 w-5 text-right font-bold">
                    {idx + 1}.
                  </span>
                  <span className="font-semibold text-zinc-300">
                    B-{shortId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {feature.properties.area.toFixed(1)} m²
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      conf < 50 ? "text-red-500" : "text-amber-500"
                    }`}
                  >
                    {conf}%
                  </span>
                  <ChevronRight className="h-3 w-3 text-zinc-600" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
