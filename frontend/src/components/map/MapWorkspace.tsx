"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Map as MaplibreMap, NavigationControl, GeoJSONSource, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Turbopack: serve the worker from public/ as a static asset
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
import { Project, GeoJSONFeature, GeoJSONFeatureCollection } from "@/types";
import { useBuildings } from "@/hooks/useBuildings";
import { useReviewState } from "@/hooks/useReviewState";
import {
  Layers,
  Search,
  SlidersHorizontal,
  Info,
  Sliders,
  MapPin,
  Percent,
  X,
  Map as MapIcon,
  Shield,
  HelpCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize,
  Minimize,
  Sliders as EditIcon,
} from "lucide-react";

interface MapWorkspaceProps {
  project: Project;
}

export default function MapWorkspace({ project }: MapWorkspaceProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);

  // Load buildings from Supabase using custom hook
  const { geojson, loading, error } = useBuildings(project.id);
  const { approveBuilding, rejectBuilding, editBuildingGeometry, reviewState } = useReviewState(project.id);

  // Merge session overrides (reviews/nudges) into geojson features list dynamically
  const mergedGeojson = useMemo((): GeoJSONFeatureCollection | null => {
    if (!geojson) return null;

    const features = geojson.features.map((f) => {
      const bid = f.properties.building_id;
      const override = reviewState[bid];
      if (override) {
        return {
          ...f,
          geometry: override.edited_geometry || f.geometry,
          properties: {
            ...f.properties,
            review_status: override.review_status,
          },
        };
      }
      return f;
    });

    return {
      ...geojson,
      features,
    } as GeoJSONFeatureCollection;
  }, [geojson, reviewState]);

  // Local state for interactive controls
  const [visMode, setVisMode] = useState<"normal" | "confidence">("normal");
  const [selectedBuilding, setSelectedBuilding] = useState<GeoJSONFeature["properties"] | null>(null);
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Derive the active feature from the geojson features list
  const selectedFeature = useMemo((): GeoJSONFeature | null => {
    if (!selectedBuilding || !mergedGeojson) return null;
    return mergedGeojson.features.find((f) => f.properties.building_id === selectedBuilding.building_id) || null;
  }, [selectedBuilding, mergedGeojson]);

  // Layer Visibility
  const [showBuildings, setShowBuildings] = useState<boolean>(true);
  const [showOrtho, setShowOrtho] = useState<boolean>(true);

  // Search & Filter state
  const [searchId, setSearchId] = useState<string>("");
  const [confFilter, setConfFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [areaFilter, setAreaFilter] = useState<"all" | "small" | "medium" | "large">("all");

  // Filter features locally in React
  const filteredGeojson = useMemo(() => {
    if (!mergedGeojson) return null;

    const filteredFeatures = mergedGeojson.features.filter((f) => {
      const props = f.properties;
      const buildingId = props.building_id || "";
      const area = props.area || 0;
      const confidence = props.confidence || 0;

      // 0. Exclude rejected building shapes from map workspace
      if (props.review_status === "rejected" || props.review_status === "REJECTED") {
        return false;
      }

      // 1. Search filter
      if (searchId && !buildingId.toLowerCase().includes(searchId.toLowerCase())) {
        return false;
      }

      // 2. Confidence filter
      if (confFilter === "high" && confidence < 0.8) return false;
      if (confFilter === "medium" && (confidence < 0.5 || confidence >= 0.8)) return false;
      if (confFilter === "low" && confidence >= 0.5) return false;

      // 3. Area filter
      if (areaFilter === "small" && area >= 50) return false;
      if (areaFilter === "medium" && (area < 50 || area >= 200)) return false;
      if (areaFilter === "large" && area < 200) return false;

      return true;
    });

    return {
      ...mergedGeojson,
      features: filteredFeatures,
    } as GeoJSONFeatureCollection;
  }, [mergedGeojson, searchId, confFilter, areaFilter]);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use a completely empty, self-hosted style to ensure no external streetmap leaks through.
    // The authoritative canvas will be purely the uploaded drone TIFF.
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
              "background-color": "#f6f7f8", // paper
            },
          },
        ],
      },
      center: [78.0, 30.0], // Fallback center
      zoom: 3,
    });

    // Add navigation controls
    map.addControl(new NavigationControl(), "top-left");
    mapRef.current = map;

    map.on("load", () => {
      // Project bounds from API might be in a local projected CRS, so we don't rely on it here.
      // We will zoom to the data once the GeoJSON is loaded in the sync effect below.

      // Create vector source for buildings GeoJSON
      map.addSource("buildings", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Layer 1: Solid Fill layer
      map.addLayer({
        id: "buildings-fill",
        type: "fill",
        source: "buildings",
        paint: {
          "fill-color": "#2f6fb0", // Geo Blue
          "fill-opacity": 0.4,
        },
      });

      // Layer 2: White outline layer
      map.addLayer({
        id: "buildings-line",
        type: "line",
        source: "buildings",
        paint: {
          "line-color": "#2f6fb0", // Geo Blue
          "line-width": 1.5,
          "line-opacity": 0.8,
        },
      });

      // Layer 3: Highlight outline layer (dashed/thick when hovering/selected)
      map.addLayer({
        id: "buildings-highlight",
        type: "line",
        source: "buildings",
        paint: {
          "line-color": "#c1531f", // Cadastral Rust
          "line-width": 3,
          "line-opacity": 0.9,
        },
        filter: ["==", "building_id", ""],
      });

      // Event listener: Hover highlight
      map.on("mousemove", "buildings-fill", (e) => {
        if (e.features && e.features.length > 0) {
          const feat = e.features[0];
          const bId = feat.properties.building_id;
          setHoveredBuildingId(bId);
          map.setFilter("buildings-highlight", ["==", "building_id", bId]);
          map.getCanvas().style.cursor = "pointer";
        }
      });

      map.on("mouseleave", "buildings-fill", () => {
        setHoveredBuildingId(null);
        map.setFilter("buildings-highlight", ["==", "building_id", ""]);
        map.getCanvas().style.cursor = "";
      });

      // Event listener: Click details selection
      map.on("click", "buildings-fill", (e) => {
        if (e.features && e.features.length > 0) {
          const props = e.features[0].properties;
          setSelectedBuilding({
            building_id: props.building_id,
            area: parseFloat(props.area),
            confidence: parseFloat(props.confidence),
          });
        }
      });

      // Signal that the map is ready so the sync effect can fire
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [project.id]);

  // Sync React-filtered GeoJSON data to MapLibre Source
  // Depends on mapReady so it re-fires once the map "load" event has set up the source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !filteredGeojson) {
      console.log("Sync skipped:", { mapExists: !!map, mapReady, hasGeojson: !!filteredGeojson });
      return;
    }

    const source = map.getSource("buildings") as GeoJSONSource;
    if (source) {
      console.log("Setting data on buildings source. Feature count:", filteredGeojson.features.length);
      source.setData(filteredGeojson as any);

      // Calculate bounding box from GeoJSON features directly to ensure correct EPSG:4326 coordinates
      if (filteredGeojson.features.length > 0) {
        let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
        let hasValidCoords = false;
        
        filteredGeojson.features.forEach((feature) => {
          if (feature.geometry && feature.geometry.type === "Polygon") {
            const coords = feature.geometry.coordinates[0];
            if (coords) {
              coords.forEach((coord: any) => {
                const lng = coord[0];
                const lat = coord[1];
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                hasValidCoords = true;
              });
            }
          }
        });

        if (hasValidCoords) {
          const fitBoundsTarget = project.bounds && 
            project.bounds.length === 4 && 
            project.bounds[0] >= -180 && project.bounds[2] <= 180 && 
            project.bounds[1] >= -90 && project.bounds[3] <= 90
              ? (project.bounds as [number, number, number, number])
              : ([minLng, minLat, maxLng, maxLat] as [number, number, number, number]);

          map.fitBounds(fitBoundsTarget, {
            padding: 50,
            maxZoom: 19,
            animate: true,
            duration: 1500,
          });

          // Overlay the dynamic Orthomosaic PNG raster layer underneath the buildings
          const orthoSourceId = "orthomosaic";
          const orthoLayerId = "orthomosaic-layer";
          
          if (!map.getSource(orthoSourceId)) {
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
            const orthoUrl = `${baseUrl}/api/v1/projects/${project.id}/orthomosaic`;
            
            const computedBounds = project.bounds && (project.bounds.length === 4 || project.bounds.length === 8)
              ? project.bounds
              : [minLng, minLat, maxLng, maxLat];
            
            let coordinates: [[number, number], [number, number], [number, number], [number, number]];
            if (computedBounds.length === 8) {
              // [TL_lon, TL_lat, TR_lon, TR_lat, BR_lon, BR_lat, BL_lon, BL_lat]
              coordinates = [
                [computedBounds[0], computedBounds[1]], // TL
                [computedBounds[2], computedBounds[3]], // TR
                [computedBounds[4], computedBounds[5]], // BR
                [computedBounds[6], computedBounds[7]], // BL
              ];
            } else {
              // Legacy fallback for old 4-element bbox
              coordinates = [
                [computedBounds[0], computedBounds[3]], // TL
                [computedBounds[2], computedBounds[3]], // TR
                [computedBounds[2], computedBounds[1]], // BR
                [computedBounds[0], computedBounds[1]], // BL
              ];
            }

            map.addSource(orthoSourceId, {
              type: "image",
              url: orthoUrl,
              coordinates: coordinates,
            });

            // Insert raster overview layer underneath the active building outline overlays
            map.addLayer({
              id: orthoLayerId,
              type: "raster",
              source: orthoSourceId,
              paint: {
                "raster-opacity": showOrtho ? 0.85 : 0,
              }
            }, "buildings-fill");
          }
        }
      }
    } else {
      console.error("buildings source not found on map!");
    }
  }, [filteredGeojson, mapReady]);

  // Sync layer visibility toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const visibility = showBuildings ? "visible" : "none";
    if (map.getLayer("buildings-fill")) {
      map.setLayoutProperty("buildings-fill", "visibility", visibility);
    }
    if (map.getLayer("buildings-line")) {
      map.setLayoutProperty("buildings-line", "visibility", visibility);
    }
  }, [showBuildings]);

  // Sync Orthomosaic layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer("orthomosaic-layer")) {
      map.setPaintProperty("orthomosaic-layer", "raster-opacity", showOrtho ? 0.85 : 0);
    }
  }, [showOrtho]);

  // Sync Normal/Confidence color modes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (visMode === "confidence") {
      // Data-driven color expression based on building confidence score
      map.setPaintProperty("buildings-fill", "fill-color", [
        "step",
        ["get", "confidence"],
        "#a83c1c", // < 0.5 (low) - Conflict Rust
        0.5,
        "#b9820a", // 0.5 to 0.8 (medium) - Review Amber
        0.8,
        "#1f7a4d", // >= 0.8 (high) - Verified Green
      ]);
      map.setPaintProperty("buildings-fill", "fill-opacity", 0.55);

      map.setPaintProperty("buildings-line", "line-color", [
        "step",
        ["get", "confidence"],
        "#a83c1c", // Conflict Rust border
        0.5,
        "#b9820a", // Review Amber border
        0.8,
        "#1f7a4d", // Verified Green border
      ]);
    } else {
      // Restore standard Geo Blue workspace color
      map.setPaintProperty("buildings-fill", "fill-color", "#2f6fb0");
      map.setPaintProperty("buildings-fill", "fill-opacity", 0.4);
      map.setPaintProperty("buildings-line", "line-color", "#2f6fb0");
    }
  }, [visMode]);

  return (
    <div className="flex flex-1 h-[calc(100vh-8rem)] relative overflow-hidden bg-paper">
      {/* 1. Left Control Panel */}
      <div className="w-72 border-r border-hairline bg-white p-6 flex flex-col gap-8 overflow-y-auto shrink-0 z-10 shadow-xs">
        {/* Layer Manager */}
        <div className="space-y-4">
          <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider flex items-center gap-1.5 font-plex-mono border-b border-hairline pb-3">
            <Layers className="h-4 w-4 text-survey-navy" /> Map Layers
          </span>
          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 text-[14px] text-survey-navy cursor-pointer font-medium hover:text-deep-chart">
              <input
                type="checkbox"
                checked={showOrtho}
                onChange={(e) => setShowOrtho(e.target.checked)}
                className="rounded-[4px] bg-white border-hairline text-survey-navy focus:ring-survey-navy h-4 w-4"
              />
              Orthomosaic Preview
            </label>
            <label className="flex items-center gap-3 text-[14px] text-survey-navy cursor-pointer font-medium hover:text-deep-chart">
              <input
                type="checkbox"
                checked={showBuildings}
                onChange={(e) => setShowBuildings(e.target.checked)}
                className="rounded-[4px] bg-white border-hairline text-survey-navy focus:ring-survey-navy h-4 w-4"
              />
              AI Building Footprints
            </label>
            <label className="flex items-center gap-3 text-[14px] text-fog cursor-not-allowed font-medium" title="Model 2 - Future Upgrade">
              <input
                type="checkbox"
                disabled
                className="rounded-[4px] bg-grid-wash border-hairline text-fog cursor-not-allowed h-4 w-4"
              />
              Parcel Boundaries (Future - Model 2)
            </label>
            <label className="flex items-center gap-3 text-[14px] text-fog cursor-not-allowed font-medium">
              <input type="checkbox" disabled className="rounded-[4px] bg-grid-wash border-hairline text-fog cursor-not-allowed h-4 w-4" />
              Road Networks (Future)
            </label>
            <label className="flex items-center gap-3 text-[14px] text-fog cursor-not-allowed font-medium">
              <input type="checkbox" disabled className="rounded-[4px] bg-grid-wash border-hairline text-fog cursor-not-allowed h-4 w-4" />
              Land-use Classification (Future)
            </label>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-5">
          <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider flex items-center gap-1.5 font-plex-mono border-b border-hairline pb-3">
            <SlidersHorizontal className="h-4 w-4 text-survey-navy" /> Filter Features
          </span>

          {/* ID Search */}
          <div className="space-y-2">
            <label className="text-caption text-instrument-gray font-bold uppercase tracking-wider font-plex-mono">
              Search Building ID
            </label>
            <div className="flex items-center bg-white border border-hairline rounded-[4px] px-3 py-2 focus-within:border-survey-navy transition-colors">
              <Search className="h-4 w-4 text-fog mr-2 shrink-0" />
              <input
                type="text"
                placeholder="e.g. bdf23..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="bg-transparent border-none text-survey-navy text-[14px] focus:outline-none w-full font-plex-mono"
              />
              {searchId && (
                <button onClick={() => setSearchId("")}>
                  <X className="h-4 w-4 text-instrument-gray hover:text-survey-navy" />
                </button>
              )}
            </div>
          </div>

          {/* Confidence Filter */}
          <div className="space-y-2">
            <label className="text-caption text-instrument-gray font-bold uppercase tracking-wider font-plex-mono block">
              Confidence Range
            </label>
            <select
              value={confFilter}
              onChange={(e: any) => setConfFilter(e.target.value)}
              className="w-full bg-white border border-hairline rounded-[4px] px-3 py-2 text-survey-navy text-[14px] focus:outline-none focus:border-survey-navy"
            >
              <option value="all">All Detections</option>
              <option value="high">High (&gt;= 80%)</option>
              <option value="medium">Medium (50% - 80%)</option>
              <option value="low">Low (&lt; 50%)</option>
            </select>
          </div>

          {/* Area Filter */}
          <div className="space-y-2">
            <label className="text-caption text-instrument-gray font-bold uppercase tracking-wider font-plex-mono block">
              Surface Area
            </label>
            <select
              value={areaFilter}
              onChange={(e: any) => setAreaFilter(e.target.value)}
              className="w-full bg-white border border-hairline rounded-[4px] px-3 py-2 text-survey-navy text-[14px] focus:outline-none focus:border-survey-navy"
            >
              <option value="all">All Sizes</option>
              <option value="small">Small (&lt; 50 m²)</option>
              <option value="medium">Medium (50 - 200 m²)</option>
              <option value="large">Large (&gt; 200 m²)</option>
            </select>
          </div>
        </div>

        {/* Feature stats counter */}
        {filteredGeojson && (
          <div className="mt-auto bg-paper border border-hairline p-4 rounded-[4px] text-caption space-y-2 font-plex-mono text-instrument-gray">
            <p className="flex justify-between border-b border-hairline pb-2">
              <span>Visible Polygons:</span>
              <span className="text-survey-navy font-bold">{filteredGeojson.features.length}</span>
            </p>
            <p className="flex justify-between pt-1">
              <span>Total Polygons:</span>
              <span>{geojson?.features.length || 0}</span>
            </p>
          </div>
        )}
      </div>

      {/* 2. Central Map Area */}
      <div className="flex-1 h-full relative">
        {/* Loading Spinner overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center gap-2 z-20">
            <Loader2 className="h-5 w-5 text-survey-navy animate-spin" />
            <span className="text-instrument-gray text-caption font-semibold">Loading building footprints...</span>
          </div>
        )}

        {/* Map Container */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Viz Mode Toggle */}
        <div className="absolute top-4 right-4 z-10 flex bg-white border border-hairline p-1.5 rounded-[6px] shadow-xs backdrop-blur-md">
          <button
            onClick={() => setVisMode("normal")}
            className={`px-4 py-2 rounded-[4px] text-caption font-semibold tracking-wider uppercase transition-all ${
              visMode === "normal"
                ? "bg-survey-navy text-white shadow-xs"
                : "text-instrument-gray hover:text-survey-navy"
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setVisMode("confidence")}
            className={`px-4 py-2 rounded-[4px] text-caption font-semibold tracking-wider uppercase transition-all ${
              visMode === "confidence"
                ? "bg-survey-navy text-white shadow-xs"
                : "text-instrument-gray hover:text-survey-navy"
            }`}
          >
            Confidence
          </button>
        </div>

        {/* Confidence Legend (shown only in confidence mode) */}
        {visMode === "confidence" && (
          <div className="absolute bottom-6 right-6 z-10 bg-white border border-hairline p-5 rounded-[6px] shadow-xs backdrop-blur-md space-y-3 font-plex-mono text-caption">
            <span className="text-instrument-gray font-bold uppercase tracking-wider block border-b border-hairline pb-2">Extraction Confidence</span>
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-verified-green"></div>
                <span className="text-survey-navy">High Confidence (&gt;= 80%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-review-amber"></div>
                <span className="text-survey-navy">Medium Confidence (50% - 80%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-conflict-rust"></div>
                <span className="text-survey-navy">Low Confidence (&lt; 50%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right Details Sidebar (Visible when building selected) */}
      {selectedBuilding && selectedFeature && (
        <div className="w-80 border-l border-hairline bg-white p-6 flex flex-col gap-6 overflow-y-auto shrink-0 z-10 shadow-xs">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <h3 className="font-semibold text-survey-navy text-[16px] flex items-center gap-2">
              <Info className="h-4 w-4 text-survey-navy" /> Building Details
            </h3>
            <button
              onClick={() => {
                setSelectedBuilding(null);
                setIsEditing(false);
              }}
              className="text-instrument-gray hover:text-conflict-rust transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 text-[14px]">
            {/* Feature ID */}
            <div className="space-y-2">
              <span className="text-caption text-fog uppercase font-plex-mono block">Building UUID</span>
              <div className="bg-paper border border-hairline p-3 rounded-[4px] font-plex-mono text-survey-navy break-all select-all text-caption">
                {selectedFeature.properties.building_id}
              </div>
            </div>

            {/* Surface Area */}
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <span className="text-caption text-instrument-gray font-plex-mono flex items-center gap-2">
                <MapPin className="h-4 w-4 text-survey-navy" /> Surface Area
              </span>
              <span className="font-semibold text-survey-navy text-[14px] font-plex-mono">
                {selectedFeature.properties.area.toFixed(2)} m²
              </span>
            </div>

            {/* Extraction Confidence */}
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <span className="text-caption text-instrument-gray font-plex-mono flex items-center gap-2">
                <Percent className="h-4 w-4 text-survey-navy" /> AI Confidence
              </span>
              <span
                className={`font-semibold text-[14px] font-plex-mono ${
                  selectedFeature.properties.confidence >= 0.8
                    ? "text-verified-green"
                    : selectedFeature.properties.confidence >= 0.5
                    ? "text-review-amber"
                    : "text-conflict-rust"
                }`}
              >
                {(selectedFeature.properties.confidence * 100).toFixed(2)}%
              </span>
            </div>

            {/* AI Source Model */}
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <span className="text-caption text-instrument-gray font-plex-mono flex items-center gap-2">
                <Sliders className="h-4 w-4 text-survey-navy" /> Source Model
              </span>
              <span className="font-medium text-survey-navy font-plex-mono uppercase text-caption">Model 1</span>
            </div>

            {/* Verification Status */}
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <span className="text-caption text-instrument-gray font-plex-mono flex items-center gap-2">
                <Shield className="h-4 w-4 text-survey-navy" /> QA Status
              </span>
              <span
                className={`font-semibold px-2 py-0.5 rounded-[3px] text-caption tracking-wide uppercase font-plex-mono border ${
                  selectedFeature.properties.review_status === "approved"
                    ? "bg-[#e7f4ec] text-verified-green border-verified-green/30"
                    : selectedFeature.properties.review_status === "edited"
                    ? "bg-grid-wash text-survey-navy border-survey-navy/30"
                    : selectedFeature.properties.review_status === "rejected"
                    ? "bg-rust-wash text-conflict-rust border-conflict-rust/30"
                    : "bg-[#fff7e6] text-review-amber border-review-amber/30"
                }`}
              >
                {selectedFeature.properties.review_status === "needs_review"
                  ? "Needs Review"
                  : selectedFeature.properties.review_status}
              </span>
            </div>

            {/* Surveyor QA Action Tools */}
            <div className="space-y-4 pt-2">
              <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider block font-plex-mono">
                Surveyor QA Options
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => approveBuilding(selectedFeature.properties.building_id)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#27c93f] hover:bg-[#20ab35] text-white py-[8px] rounded-[4px] text-[14px] font-semibold transition-colors shadow-xs"
                  title="Approve Shape"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    rejectBuilding(selectedFeature.properties.building_id);
                    setSelectedBuilding(null); // Deselect on rejection as shape hides
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-conflict-rust hover:bg-conflict-rust/90 text-white py-[8px] rounded-[4px] text-[14px] font-semibold transition-colors shadow-xs"
                  title="Reject Shape"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>

              {/* Toggle micro-editing mode */}
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`w-full flex items-center justify-center gap-2 border py-[8px] rounded-[4px] text-[14px] font-medium transition-colors ${
                  isEditing
                    ? "bg-survey-navy border-survey-navy text-white shadow-xs"
                    : "bg-white border-hairline text-instrument-gray hover:bg-grid-wash hover:text-survey-navy"
                }`}
              >
                <EditIcon className="h-4 w-4" />
                {isEditing ? "Disable Alignment Editor" : "Enable Alignment Editor"}
              </button>

              {/* Nudge controls displayed dynamically */}
              {isEditing && selectedFeature.geometry.type === "Polygon" && (
                <div className="p-4 bg-paper border border-hairline rounded-[6px] space-y-4 font-plex-mono text-caption">
                  <span className="text-instrument-gray font-bold uppercase tracking-wider block">Nudge Offset controls</span>
                  
                  {/* Nudge D-pad grid */}
                  <div className="grid grid-cols-3 gap-2 w-28 mx-auto">
                    <div></div>
                    <button
                      onClick={() => handleNudge("N")}
                      className="bg-white border border-hairline hover:border-survey-navy text-survey-navy p-2 rounded-[4px] flex items-center justify-center transition-colors shadow-xs"
                      title="Nudge North"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <div></div>
                    <button
                      onClick={() => handleNudge("W")}
                      className="bg-white border border-hairline hover:border-survey-navy text-survey-navy p-2 rounded-[4px] flex items-center justify-center transition-colors shadow-xs"
                      title="Nudge West"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center justify-center text-[10px] text-fog font-bold">ALIGN</div>
                    <button
                      onClick={() => handleNudge("E")}
                      className="bg-white border border-hairline hover:border-survey-navy text-survey-navy p-2 rounded-[4px] flex items-center justify-center transition-colors shadow-xs"
                      title="Nudge East"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <div></div>
                    <button
                      onClick={() => handleNudge("S")}
                      className="bg-white border border-hairline hover:border-survey-navy text-survey-navy p-2 rounded-[4px] flex items-center justify-center transition-colors shadow-xs"
                      title="Nudge South"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <div></div>
                  </div>

                  <div className="h-[1px] bg-hairline my-3"></div>

                  <span className="text-instrument-gray font-bold uppercase tracking-wider block">Scale Boundaries</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleScale(1.03)}
                      className="flex-1 flex items-center justify-center gap-1 bg-white border border-hairline hover:border-survey-navy text-survey-navy py-2 rounded-[4px] transition-colors font-semibold shadow-xs"
                    >
                      <Maximize className="h-3.5 w-3.5" />
                      Grow
                    </button>
                    <button
                      onClick={() => handleScale(0.97)}
                      className="flex-1 flex items-center justify-center gap-1 bg-white border border-hairline hover:border-survey-navy text-survey-navy py-2 rounded-[4px] transition-colors font-semibold shadow-xs"
                    >
                      <Minimize className="h-3.5 w-3.5" />
                      Shrink
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto bg-paper border border-hairline p-4 rounded-[6px] flex items-start gap-3 text-caption text-instrument-gray">
            <HelpCircle className="h-5 w-5 shrink-0 text-instrument-gray" />
            <p className="leading-relaxed">
              Human reviews approve or modify the polygon's spatial vertices locally before generating authoritative GeoJSON cadastral bundles.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // Math translation offsets
  const NUDGE_OFFSET = 0.000005;

  const handleNudge = (direction: "N" | "S" | "E" | "W") => {
    if (!selectedFeature || selectedFeature.geometry.type !== "Polygon") return;
    
    const currentCoords = selectedFeature.geometry.coordinates[0];
    const newCoords = currentCoords.map((coord: any) => {
      let lng = coord[0];
      let lat = coord[1];
      if (direction === "N") lat += NUDGE_OFFSET;
      if (direction === "S") lat -= NUDGE_OFFSET;
      if (direction === "E") lng += NUDGE_OFFSET;
      if (direction === "W") lng -= NUDGE_OFFSET;
      return [lng, lat];
    });

    editBuildingGeometry(selectedFeature.properties.building_id, [newCoords]);
  };

  const handleScale = (factor: number) => {
    if (!selectedFeature || selectedFeature.geometry.type !== "Polygon") return;

    const currentCoords = selectedFeature.geometry.coordinates[0];
    
    let sumLng = 0;
    let sumLat = 0;
    currentCoords.forEach((coord: any) => {
      sumLng += coord[0];
      sumLat += coord[1];
    });
    const centroidLng = sumLng / currentCoords.length;
    const centroidLat = sumLat / currentCoords.length;

    const newCoords = currentCoords.map((coord: any) => {
      const lng = centroidLng + (coord[0] - centroidLng) * factor;
      const lat = centroidLat + (coord[1] - centroidLat) * factor;
      return [lng, lat];
    });

    editBuildingGeometry(selectedFeature.properties.building_id, [newCoords]);
  };
}
