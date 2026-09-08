"use client";

import React, { useMemo } from "react";
import {
  Info,
  MapPin,
  Percent,
  Shield,
  Sparkles,
  X,
  CheckCircle,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Palette,
} from "lucide-react";
import * as turf from "@turf/turf";
import { GeoJSONFeature } from "@/types";
import { EditBufferEntry } from "@/hooks/useGISEditor";

interface GISFeatureInspectorProps {
  feature: GeoJSONFeature;
  bufferEntry?: EditBufferEntry;
  onApprove: (id: string) => void;
  onReject: (id: string, comment?: string) => void;
  onReset: (id: string) => void;
  onCommentChange: (id: string, text: string) => void;
  onClose: () => void;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;

  // Real-time properties updater props
  updateFeatureProperties?: (id: string, properties: any) => void;
  setWorkingCoords?: (id: string, coords: number[][][]) => void;
}

// Helper to generate circle coordinates
function generateCircleCoords(center: [number, number], radiusMeters: number, steps = 64): number[][][] {
  const coords: number[][] = [];
  const [lng, lat] = center;
  const earthRadius = 6378137; // in meters
  
  for (let i = 0; i < steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const dLat = (radiusMeters * Math.sin(angle)) / earthRadius;
    const dLng = (radiusMeters * Math.cos(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
    
    const pLat = lat + (dLat * 180) / Math.PI;
    const pLng = lng + (dLng * 180) / Math.PI;
    coords.push([pLng, pLat]);
  }
  coords.push([coords[0][0], coords[0][1]]); // close polygon
  return [coords];
}

export default function GISFeatureInspector({
  feature,
  bufferEntry,
  onApprove,
  onReject,
  onReset,
  onCommentChange,
  onClose,
  isEditing,
  setIsEditing,
  updateFeatureProperties = () => {},
  setWorkingCoords = () => {},
}: GISFeatureInspectorProps) {
  const bid = feature.properties.building_id;

  const getCentroid = (coords: number[][][]) => {
    const ring = coords[0];
    if (!ring || ring.length === 0) return [0, 0] as [number, number];
    let sumLng = 0, sumLat = 0;
    const len = ring.length - 1 > 0 ? ring.length - 1 : ring.length;
    for (let i = 0; i < len; i++) {
      sumLng += ring[i][0];
      sumLat += ring[i][1];
    }
    return [sumLng / len, sumLat / len] as [number, number];
  };

  // Calculate live area and perimeter in real-time
  const metrics = useMemo(() => {
    const coords = bufferEntry?.workingCoords || (feature.geometry.coordinates as number[][][]);
    if (!coords || coords.length === 0) return { area: 0, perimeter: 0 };

    try {
      const poly = turf.polygon(coords);
      const area = turf.area(poly);
      const perimeter = turf.length(poly, { units: "meters" });
      return { area, perimeter };
    } catch (e) {
      return { area: feature.properties.area || 0, perimeter: 0 };
    }
  }, [bufferEntry?.workingCoords, feature]);

  const activeStatus = bufferEntry?.reviewStatus || feature.properties.review_status || "needs_review";

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return "bg-emerald-950 text-emerald-400 border border-emerald-800/30";
      case "EDITED":
      case "CREATED":
        return "bg-blue-950 text-blue-400 border border-blue-800/30";
      case "REJECTED":
      case "DELETED":
        return "bg-red-950 text-red-400 border border-red-800/30";
      default:
        return "bg-amber-950 text-amber-400 border border-amber-800/30";
    }
  };

  // Properties extraction
  const name = bufferEntry?.properties?.name || feature.properties.name || `Feature ${bid.substring(0, 4)}`;
  const isLocked = bufferEntry?.properties?.is_locked || false;
  const isVisible = bufferEntry?.properties?.is_visible !== false;
  const shapeType = bufferEntry?.properties?.shape_type || "polygon";
  const zIndex = bufferEntry?.properties?.z_index || 0;
  const radius = bufferEntry?.properties?.radius || 0;
  const rotation = bufferEntry?.properties?.rotation || 0;
  const fill = bufferEntry?.properties?.fill || "#3b82f6";
  const stroke = bufferEntry?.properties?.stroke || "#3b82f6";
  const strokeWidth = bufferEntry?.properties?.stroke_width ?? 1.5;
  const opacity = bufferEntry?.properties?.opacity ?? 0.4;

  const handleRotationChange = (newDeg: number) => {
    const dDeg = newDeg - rotation;
    const dRad = (dDeg * Math.PI) / 180;
    
    const coords = bufferEntry?.workingCoords;
    if (!coords || coords.length === 0) return;
    
    const center = getCentroid(coords);
    const cosA = Math.cos(dRad);
    const sinA = Math.sin(dRad);
    
    const newCoords = coords.map((r) =>
      r.map((c) => {
        const dx = c[0] - center[0];
        const dy = c[1] - center[1];
        return [
          center[0] + dx * cosA - dy * sinA,
          center[1] + dx * sinA + dy * cosA
        ];
      })
    );
    
    setWorkingCoords(bid, newCoords);
    updateFeatureProperties(bid, { rotation: newDeg });
  };

  const handleRadiusChange = (newRadius: number) => {
    const coords = bufferEntry?.workingCoords;
    if (!coords) return;
    
    const center = getCentroid(coords);
    const regenerated = generateCircleCoords(center, newRadius);
    setWorkingCoords(bid, regenerated);
    updateFeatureProperties(bid, { radius: newRadius });
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 select-none z-10 text-zinc-300 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-bold font-mono tracking-wider uppercase">Property Inspector</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Inspector panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
        
        {/* Core Attributes */}
        <div className="space-y-3.5">
          {/* Feature Name Input */}
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block">Overlay Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => updateFeatureProperties(bid, { name: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Locked / Visible settings */}
          <div className="flex gap-2">
            <button
              onClick={() => updateFeatureProperties(bid, { is_locked: !isLocked })}
              className={`flex-1 flex items-center justify-center gap-1.5 border py-2 rounded text-[11px] font-semibold transition-colors ${
                isLocked
                  ? "bg-red-950/40 border-red-800 text-red-400 hover:bg-red-900/40"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-850"
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5" /> Locked
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5" /> Unlocked
                </>
              )}
            </button>
            <button
              onClick={() => updateFeatureProperties(bid, { is_visible: !isVisible })}
              className={`flex-1 flex items-center justify-center gap-1.5 border py-2 rounded text-[11px] font-semibold transition-colors ${
                !isVisible
                  ? "bg-zinc-900 border-zinc-800 text-zinc-600"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-850"
              }`}
            >
              {isVisible ? (
                <>
                  <Eye className="h-3.5 w-3.5" /> Visible
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Hidden
                </>
              )}
            </button>
          </div>

          {/* UUID */}
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block">Feature ID</span>
            <div className="bg-zinc-900 border border-zinc-850 p-2 rounded text-[10px] font-mono text-zinc-400 break-all select-all">
              {bid}
            </div>
          </div>
        </div>

        {/* Spatial Properties */}
        <div className="space-y-3 pt-3 border-t border-zinc-900">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block">Spatial properties</span>

          {/* Shape Type */}
          <div className="flex items-center justify-between py-1 border-b border-zinc-900">
            <span className="text-zinc-400">Shape Class</span>
            <span className="font-semibold capitalize font-mono text-zinc-200">{shapeType}</span>
          </div>

          {/* Area Metric */}
          <div className="flex items-center justify-between py-1 border-b border-zinc-900">
            <span className="text-zinc-400">{shapeType === "line" ? "Length" : "Area"}</span>
            <span className="font-semibold font-mono text-zinc-200">
              {metrics.area.toFixed(2)} {shapeType === "line" ? "m" : "m²"}
            </span>
          </div>

          {/* Perimeter */}
          {shapeType !== "line" && (
            <div className="flex items-center justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-400">Perimeter</span>
              <span className="font-semibold font-mono text-zinc-200">
                {metrics.perimeter.toFixed(2)} m
              </span>
            </div>
          )}

          {/* Z-Index Order */}
          <div className="flex items-center justify-between py-1 border-b border-zinc-900">
            <span className="text-zinc-400">Stack Index (Z-Order)</span>
            <input
              type="number"
              value={zIndex}
              onChange={(e) => updateFeatureProperties(bid, { z_index: parseInt(e.target.value) || 0 })}
              className="w-16 bg-zinc-900 border border-zinc-850 text-right px-1.5 py-0.5 rounded text-zinc-200 font-mono text-[11px]"
            />
          </div>

          {/* Circle radius editing */}
          {shapeType === "circle" && (
            <div className="flex items-center justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-400">Radius (meters)</span>
              <input
                type="number"
                step="0.5"
                value={radius.toFixed(1)}
                onChange={(e) => handleRadiusChange(parseFloat(e.target.value) || 1)}
                className="w-16 bg-zinc-900 border border-zinc-850 text-right px-1.5 py-0.5 rounded text-zinc-200 font-mono text-[11px]"
              />
            </div>
          )}

          {/* Geometric Rotation */}
          {shapeType !== "line" && (
            <div className="flex items-center justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-400">Rotation (degrees)</span>
              <input
                type="range"
                min="0"
                max="360"
                value={rotation}
                onChange={(e) => handleRotationChange(parseInt(e.target.value) || 0)}
                className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="font-mono text-zinc-300 w-8 text-right">{rotation}°</span>
            </div>
          )}
        </div>

        {/* Styling / Aesthetics */}
        <div className="space-y-3 pt-3 border-t border-zinc-900">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block flex items-center gap-1">
            <Palette className="h-3.5 w-3.5 text-indigo-400" /> Shape Aesthetics
          </span>

          {/* Fill Color Picker */}
          {shapeType !== "line" && (
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Fill Color</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-zinc-400">{fill}</span>
                <input
                  type="color"
                  value={fill}
                  onChange={(e) => updateFeatureProperties(bid, { fill: e.target.value })}
                  className="w-6 h-5 rounded border border-zinc-800 bg-transparent cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Stroke Color Picker */}
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Stroke Color</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-zinc-400">{stroke}</span>
              <input
                type="color"
                value={stroke}
                onChange={(e) => updateFeatureProperties(bid, { stroke: e.target.value })}
                className="w-6 h-5 rounded border border-zinc-800 bg-transparent cursor-pointer"
              />
            </div>
          </div>

          {/* Stroke Width */}
          <div className="space-y-1">
            <div className="flex justify-between text-zinc-400">
              <span>Stroke Thickness</span>
              <span className="font-mono">{strokeWidth}px</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={strokeWidth}
              onChange={(e) => updateFeatureProperties(bid, { stroke_width: parseFloat(e.target.value) })}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Shape Opacity */}
          {shapeType !== "line" && (
            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Fill Opacity</span>
                <span className="font-mono">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => updateFeatureProperties(bid, { opacity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          )}
        </div>

        {/* QA validation details */}
        <div className="space-y-3 pt-3 border-t border-zinc-900">
          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono">
            <span>QA Validation Decision</span>
            <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase ${getStatusBadge(activeStatus)}`}>
              {activeStatus === "needs_review" ? "Needs Review" : activeStatus}
            </span>
          </div>

          {/* Approve / Reject */}
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(bid)}
              className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded font-semibold transition-colors shadow-sm"
            >
              <CheckCircle className="h-3 w-3" /> Approve
            </button>
            <button
              onClick={() => onReject(bid, bufferEntry?.reviewComment)}
              className="flex-1 flex items-center justify-center gap-1 bg-red-650 hover:bg-red-600 text-white py-1.5 rounded font-semibold transition-colors shadow-sm"
            >
              <Trash2 className="h-3 w-3" /> Reject
            </button>
          </div>

          {/* Toggle Interactive Boundary Editing */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`w-full flex items-center justify-center gap-1.5 border py-1.5 rounded font-semibold transition-colors ${
              isEditing
                ? "bg-zinc-200 border-zinc-200 text-zinc-950 hover:bg-white"
                : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-400" />
            {isEditing ? "Deactivate Vertex Edit" : "Activate Vertex Edit (E)"}
          </button>

          {/* Review Comments */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block">
              Surveyor Comments
            </label>
            <textarea
              rows={2.5}
              placeholder="Add structural annotations..."
              value={bufferEntry?.reviewComment || ""}
              onChange={(e) => onCommentChange(bid, e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-none font-sans"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
