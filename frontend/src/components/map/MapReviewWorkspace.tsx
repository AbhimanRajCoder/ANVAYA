"use client";

import React, { useEffect, useRef, useState } from "react";
import { Map as MaplibreMap, NavigationControl, GeoJSONSource, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GeoJSONFeature } from "@/types";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize,
  Minimize,
  Loader2,
  Info,
} from "lucide-react";

// Turbopack: serve the worker from public/ as a static asset
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

interface MapReviewWorkspaceProps {
  projectId: string;
  projectBounds: number[]; // [minLng, minLat, maxLng, maxLat]
  activeFeature: GeoJSONFeature;
  onEditCoordinates: (newCoords: number[][][]) => void;
}

export default function MapReviewWorkspace({
  projectId,
  projectBounds,
  activeFeature,
  onEditCoordinates,
}: MapReviewWorkspaceProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    console.log("Initializing Review Map for feature:", activeFeature.properties.building_id);
    const map = new MaplibreMap({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#09090b", // zinc-950
            },
          },
        ],
      },
      center: [78.0, 30.0],
      zoom: 17,
      maxZoom: 22,
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    mapRef.current = map;

    map.on("load", () => {
      // Dynamic Orthomosaic Preview Layer
      if (projectBounds && projectBounds.length === 4) {
        const [minLng, minLat, maxLng, maxLat] = projectBounds;
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
        const orthoUrl = `${baseUrl}/api/v1/projects/${projectId}/orthomosaic`;

        map.addSource("orthomosaic", {
          type: "image",
          url: orthoUrl,
          coordinates: [
            [minLng, maxLat], // top left
            [maxLng, maxLat], // top right
            [maxLng, minLat], // bottom right
            [minLng, minLat]  // bottom left
          ]
        });

        map.addLayer({
          id: "orthomosaic-layer",
          type: "raster",
          source: "orthomosaic",
          paint: {
            "raster-opacity": 0.85,
          }
        });
      }

      // Add geojson source
      map.addSource("review-feature", {
        type: "geojson",
        data: activeFeature as any,
      });

      // Fill Layer
      map.addLayer({
        id: "feature-fill",
        type: "fill",
        source: "review-feature",
        paint: {
          "fill-color": "#facc15", // yellow for highlighted active feature
          "fill-opacity": 0.35,
        },
      });

      // Outline Line Layer
      map.addLayer({
        id: "feature-line",
        type: "line",
        source: "review-feature",
        paint: {
          "line-color": "#facc15",
          "line-width": 2.5,
        },
      });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [activeFeature.properties.building_id]); // Recreate map instance on building ID change to ensure clean load

  // Sync activeFeature geometry changes and center/fit map bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !activeFeature) return;

    const source = map.getSource("review-feature") as GeoJSONSource;
    if (source) {
      source.setData(activeFeature as any);
    }

    // Compute bounding box and center map to feature
    if (activeFeature.geometry && activeFeature.geometry.type === "Polygon") {
      const coords = activeFeature.geometry.coordinates[0];
      if (coords && coords.length > 0) {
        let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
        
        coords.forEach((coord: any) => {
          const lng = coord[0];
          const lat = coord[1];
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });

        map.fitBounds([minLng, minLat, maxLng, maxLat], {
          padding: 100,
          maxZoom: 20,
          animate: true,
          duration: 1000,
        });
      }
    }
  }, [activeFeature, mapReady]);

  // Math translation offsets (roughly 0.5 meters at standard latitudes)
  const NUDGE_OFFSET = 0.000005;

  const handleNudge = (direction: "N" | "S" | "E" | "W") => {
    if (!activeFeature || activeFeature.geometry.type !== "Polygon") return;
    
    const currentCoords = activeFeature.geometry.coordinates[0];
    const newCoords = currentCoords.map((coord: any) => {
      let lng = coord[0];
      let lat = coord[1];
      if (direction === "N") lat += NUDGE_OFFSET;
      if (direction === "S") lat -= NUDGE_OFFSET;
      if (direction === "E") lng += NUDGE_OFFSET;
      if (direction === "W") lng -= NUDGE_OFFSET;
      return [lng, lat];
    });

    onEditCoordinates([newCoords]);
  };

  const handleScale = (factor: number) => {
    if (!activeFeature || activeFeature.geometry.type !== "Polygon") return;

    const currentCoords = activeFeature.geometry.coordinates[0];
    
    // 1. Calculate centroid
    let sumLng = 0;
    let sumLat = 0;
    currentCoords.forEach((coord: any) => {
      sumLng += coord[0];
      sumLat += coord[1];
    });
    const centroidLng = sumLng / currentCoords.length;
    const centroidLat = sumLat / currentCoords.length;

    // 2. Scale vertices outward/inward from centroid
    const newCoords = currentCoords.map((coord: any) => {
      const lng = centroidLng + (coord[0] - centroidLng) * factor;
      const lat = centroidLat + (coord[1] - centroidLat) * factor;
      return [lng, lat];
    });

    onEditCoordinates([newCoords]);
  };

  return (
    <div className="flex flex-1 flex-col md:flex-row h-full relative overflow-hidden bg-white rounded-[6px] border border-hairline shadow-xs">
      {/* Map element */}
      <div className="flex-1 h-full relative min-h-[300px]">
        {!mapReady && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center gap-2 z-10">
            <Loader2 className="h-5 w-5 text-survey-navy animate-spin" />
            <span className="text-instrument-gray text-caption font-semibold">Focusing review target...</span>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Surveyor editing sidebar overlay */}
      <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-hairline bg-paper p-5 flex flex-col justify-between shrink-0 font-plex-mono space-y-4">
        <div className="space-y-4">
          <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-hairline pb-3">
            <Info className="h-4 w-4 text-survey-navy" /> Surveyor Tools
          </span>
          <p className="text-caption text-fog leading-relaxed font-sans">
            Use the alignment tools below to nudge or scale the AI-predicted footprint until it aligns with the orthomosaic structure.
          </p>

          <div className="space-y-2 pt-2">
            <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider block">Nudge Geometry</span>
            <div className="grid grid-cols-3 gap-2 w-32 mx-auto pt-2">
              <div></div>
              <button
                onClick={() => handleNudge("N")}
                className="bg-white border border-hairline hover:border-survey-navy text-survey-navy p-2 rounded-[4px] flex items-center justify-center transition-all shadow-xs"
                title="Nudge North"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <div></div>
              <button
                onClick={() => handleNudge("W")}
                className="bg-white border border-hairline hover:border-survey-navy text-survey-navy p-2 rounded-[4px] flex items-center justify-center transition-all shadow-xs"
                title="Nudge West"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center justify-center text-[10px] text-fog font-bold">NUDGE</div>
              <button
                onClick={() => handleNudge("E")}
                className="bg-white border border-hairline hover:border-survey-navy text-survey-navy p-2 rounded-[4px] flex items-center justify-center transition-all shadow-xs"
                title="Nudge East"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
              <div></div>
              <button
                onClick={() => handleNudge("S")}
                className="bg-white border border-hairline hover:border-survey-navy text-survey-navy p-2 rounded-[4px] flex items-center justify-center transition-all shadow-xs"
                title="Nudge South"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <div></div>
            </div>
          </div>

          <div className="h-[1px] bg-hairline my-2"></div>

          {/* Scale controls */}
          <div className="space-y-2">
            <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider block">Scale Boundaries</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleScale(1.05)}
                className="flex-1 flex items-center justify-center gap-1 bg-white border border-hairline hover:border-survey-navy text-survey-navy py-2 rounded-[4px] transition-all font-semibold font-sans text-caption shadow-xs"
                title="Scale Up (Expand)"
              >
                <Maximize className="h-3.5 w-3.5" />
                Expand
              </button>
              <button
                onClick={() => handleScale(0.95)}
                className="flex-1 flex items-center justify-center gap-1 bg-white border border-hairline hover:border-survey-navy text-survey-navy py-2 rounded-[4px] transition-all font-semibold font-sans text-caption shadow-xs"
                title="Scale Down (Shrink)"
              >
                <Minimize className="h-3.5 w-3.5" />
                Shrink
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-hairline p-3 rounded-[4px] text-caption text-instrument-gray leading-[1.6]">
          Centroid coord:
          <div className="font-plex-mono text-survey-navy font-semibold mt-1 select-all break-all">
            {(activeFeature.geometry.coordinates[0][0] as any)[0].toFixed(6)}, {(activeFeature.geometry.coordinates[0][0] as any)[1].toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  );
}
