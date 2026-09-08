"use client";

import React, { useState } from "react";
import {
  Layers,
  Sliders,
  Sun,
  Eye,
  EyeOff,
  Info,
  Lock,
  Unlock,
  Trash2,
  Target,
  GripVertical,
  Square,
  Circle,
  Slash,
  Pentagon,
  FileCode,
} from "lucide-react";
import { GeoJSONFeature } from "@/types";
import { Map as MaplibreMap } from "maplibre-gl";

interface GISLayerPanelProps {
  showOrtho: boolean;
  setShowOrtho: (val: boolean) => void;
  orthoOpacity: number;
  setOrthoOpacity: (val: number) => void;
  showBuildings: boolean;
  setShowBuildings: (val: boolean) => void;
  buildingsOpacity: number;
  setBuildingsOpacity: (val: number) => void;
  visMode: "normal" | "confidence" | "review";
  setVisMode: (val: "normal" | "confidence" | "review") => void;

  // TIFF controls
  brightness: number;
  setBrightness: (val: number) => void;
  contrast: number;
  setContrast: (val: number) => void;
  grayscale: boolean;
  setGrayscale: (val: boolean) => void;

  // Overlays management
  features?: GeoJSONFeature[];
  selectedId?: string | null;
  selectFeature?: (id: string | null) => void;
  updateFeatureProperties?: (id: string, properties: any) => void;
  deleteFeature?: (id: string) => void;
  mapInstance?: MaplibreMap | null;
}

export default function GISLayerPanel({
  showOrtho,
  setShowOrtho,
  orthoOpacity,
  setOrthoOpacity,
  showBuildings,
  setShowBuildings,
  buildingsOpacity,
  setBuildingsOpacity,
  visMode,
  setVisMode,
  brightness,
  setBrightness,
  contrast,
  setContrast,
  grayscale,
  setGrayscale,
  features = [],
  selectedId = null,
  selectFeature = () => {},
  updateFeatureProperties = () => {},
  deleteFeature = () => {},
  mapInstance = null,
}: GISLayerPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Focus / Zoom to feature
  const handleZoomTo = (e: React.MouseEvent, feature: GeoJSONFeature) => {
    e.stopPropagation();
    if (!mapInstance) return;
    const geom = feature.geometry;
    let coords: number[][] = [];
    if (geom.type === "Polygon") {
      coords = geom.coordinates[0] as number[][];
    } else if (geom.type === "LineString") {
      coords = geom.coordinates as number[][];
    } else if (geom.type === "Point") {
      coords = [geom.coordinates as number[]];
    }
    
    if (coords && coords.length > 0) {
      let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
      coords.forEach((c) => {
        if (c[0] < minLng) minLng = c[0];
        if (c[0] > maxLng) maxLng = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[1] > maxLat) maxLat = c[1];
      });
      mapInstance.fitBounds([minLng, minLat, maxLng, maxLat], {
        padding: 100,
        maxZoom: 20,
        animate: true,
        duration: 800,
      });
    }
  };

  // Get corresponding Lucide Icon for shape type
  const getShapeIcon = (shapeType: string) => {
    switch (shapeType) {
      case "rectangle":
        return <Square className="h-3.5 w-3.5 text-blue-400" />;
      case "circle":
        return <Circle className="h-3.5 w-3.5 text-amber-400" />;
      case "line":
        return <Slash className="h-3.5 w-3.5 text-green-400" />;
      case "polygon":
      default:
        return <Pentagon className="h-3.5 w-3.5 text-purple-400" />;
    }
  };

  // HTML5 drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const list = [...features];
    const [movedItem] = list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, movedItem);

    // Update Z-Index for all features (higher rendering index = top of list = higher z-index)
    list.forEach((feat, idx) => {
      const computedZ = (list.length - idx) * 10;
      updateFeatureProperties(feat.properties.building_id, { z_index: computedZ });
    });

    setDraggedIndex(null);
  };

  // Filter out deleted features for the layers panel listing
  const activeFeaturesList = features.filter((f) => f.properties.review_status !== "DELETED");

  return (
    <div className="w-64 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 select-none z-10 text-zinc-300 overflow-hidden">
      {/* 1. Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <Layers className="h-4 w-4 text-indigo-400" />
        <span className="text-xs font-bold font-mono tracking-wider uppercase">Layer Manager</span>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Active base map layers */}
        <div className="space-y-3">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block">Base Map Layers</span>

          {/* Orthomosaic */}
          <div className="space-y-1.5 border-b border-zinc-900 pb-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOrtho}
                  onChange={(e) => setShowOrtho(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                Orthomosaic TIFF
              </label>
              <button onClick={() => setShowOrtho(!showOrtho)} className="text-zinc-500 hover:text-zinc-300">
                {showOrtho ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </div>
            {showOrtho && (
              <div className="flex items-center gap-2 pl-5.5">
                <span className="text-[9px] text-zinc-500 font-mono">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={orthoOpacity}
                  onChange={(e) => setOrthoOpacity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[9px] text-zinc-400 font-mono w-8 text-right">
                  {Math.round(orthoOpacity * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* AI Buildings layer toggle */}
          <div className="space-y-1.5 border-b border-zinc-900 pb-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBuildings}
                  onChange={(e) => setShowBuildings(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                Annotation Footprints
              </label>
              <button onClick={() => setShowBuildings(!showBuildings)} className="text-zinc-500 hover:text-zinc-300">
                {showBuildings ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </div>
            {showBuildings && (
              <div className="flex items-center gap-2 pl-5.5">
                <span className="text-[9px] text-zinc-500 font-mono">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={buildingsOpacity}
                  onChange={(e) => setBuildingsOpacity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[9px] text-zinc-400 font-mono w-8 text-right">
                  {Math.round(buildingsOpacity * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Color Legend */}
        <div className="space-y-2 pb-2">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block">Color Rendering</span>
          <select
            value={visMode}
            onChange={(e: any) => setVisMode(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="normal">Standard (Default styles)</option>
            <option value="confidence">Confidence Classification</option>
            <option value="review">Surveyor Review Status</option>
          </select>
        </div>

        {/* TIFF visual adjustments */}
        <div className="space-y-3.5 pt-2 border-t border-zinc-900 pb-2">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block flex items-center gap-1">
            <Sun className="h-3.5 w-3.5 text-indigo-400" /> TIFF Visuals
          </span>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Brightness</span>
              <span>{brightness}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Contrast</span>
              <span>{contrast}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={contrast}
              onChange={(e) => setContrast(parseInt(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={grayscale}
              onChange={(e) => setGrayscale(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 h-3.5 w-3.5"
            />
            Desaturate (Grayscale)
          </label>
        </div>

        {/* Overlays / Individual Features List */}
        <div className="space-y-2 pt-2 border-t border-zinc-900 flex flex-col h-[220px] overflow-hidden">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-plex-mono block">Overlays / Layers Stack</span>
          
          {activeFeaturesList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded p-4 text-center">
              <FileCode className="h-6 w-6 text-zinc-750 mb-1" />
              <span className="text-[10px] text-zinc-500">No active overlays drawn. Use drawing tools to add one.</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {activeFeaturesList.map((feat, idx) => {
                const bid = feat.properties.building_id;
                const active = selectedId === bid;
                
                const isLocked = feat.properties.is_locked || false;
                const isVisible = feat.properties.is_visible !== false;
                const name = feat.properties.name || `Shape ${bid.substring(0, 4)}`;
                const shapeType = feat.properties.shape_type || "polygon";

                return (
                  <div
                    key={bid}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => selectFeature(bid)}
                    className={`flex items-center justify-between gap-1 p-1.5 rounded cursor-pointer transition-colors border ${
                      active
                        ? "bg-zinc-800 border-yellow-500/60 text-white"
                        : "bg-zinc-900/60 border-zinc-850 hover:bg-zinc-800/80 text-zinc-300"
                    }`}
                  >
                    {/* Left: Drag grip & Shape Icon & Rename Input */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className="text-zinc-600 hover:text-zinc-400 cursor-grab px-0.5">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                      {getShapeIcon(shapeType)}
                      <input
                        type="text"
                        value={name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateFeatureProperties(bid, { name: e.target.value })}
                        className="bg-transparent border-none text-[11px] font-sans font-medium focus:outline-none focus:bg-zinc-950 focus:px-1 rounded truncate min-w-0 w-full"
                      />
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Zoom to object */}
                      <button
                        onClick={(e) => handleZoomTo(e, feat)}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-850"
                        title="Zoom to feature"
                      >
                        <Target className="h-3 w-3" />
                      </button>

                      {/* Lock / Unlock */}
                      <button
                        onClick={() => updateFeatureProperties(bid, { is_locked: !isLocked })}
                        className={`p-1 rounded ${isLocked ? "text-red-400" : "text-zinc-500 hover:text-zinc-300"}`}
                        title={isLocked ? "Unlock shape" : "Lock shape"}
                      >
                        {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      </button>

                      {/* Hide / Show */}
                      <button
                        onClick={() => updateFeatureProperties(bid, { is_visible: !isVisible })}
                        className={`p-1 rounded ${!isVisible ? "text-zinc-600" : "text-zinc-500 hover:text-zinc-300"}`}
                        title={isVisible ? "Hide shape" : "Show shape"}
                      >
                        {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteFeature(bid)}
                        className="p-1 rounded text-zinc-650 hover:text-red-500 hover:bg-zinc-850"
                        title="Delete shape"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <div className="p-3 bg-zinc-900/40 border-t border-zinc-800 flex items-start gap-2.5 text-[10px] text-zinc-500 leading-normal">
        <Info className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
        <span>TIFF adjustments only alter screen visualization. Original raster remains unmodified.</span>
      </div>
    </div>
  );
}
