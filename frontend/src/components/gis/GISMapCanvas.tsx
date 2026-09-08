"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Map as MaplibreMap, NavigationControl, GeoJSONSource, LngLat, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Project, GeoJSONFeature, GeoJSONFeatureCollection } from "@/types";
import { GISTool, EditBufferEntry } from "@/hooks/useGISEditor";
import { Loader2, X } from "lucide-react";
import * as turf from "@turf/turf";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

interface GISMapCanvasProps {
  project: Project;
  geojson: GeoJSONFeatureCollection | null;
  loading: boolean;
  activeTool: GISTool;
  setActiveTool: (tool: GISTool) => void;
  selectedId: string | null;
  selectFeature: (id: string | null, multi?: boolean) => void;
  workingCoords: number[][][] | null;
  moveVertex: (bid: string, ringIdx: number, vertexIdx: number, lng: number, lat: number) => void;
  commitVertexMove: (bid: string, before: number[][][]) => void;
  setWorkingCoords: (bid: string, coords: number[][][]) => void;
  commitGeometryChange: (bid: string, before: number[][][], type: any) => void;
  isDraggingVertex: boolean;
  setIsDraggingVertex: (val: boolean) => void;
  addVertex: (bid: string, ringIdx: number, afterIdx: number, lng: number, lat: number) => void;
  deleteVertex: (bid: string, ringIdx: number, vertexIdx: number) => void;
  compareMode: boolean;
  showOrtho: boolean;
  orthoOpacity: number;
  showBuildings: boolean;
  buildingsOpacity: number;
  visMode: "normal" | "confidence" | "review";
  onCursorMove: (lng: number, lat: number) => void;
  onZoomChange: (zoom: number) => void;
  onMapInit: (map: MaplibreMap) => void;
  scribbleClass?: "tree" | "road";
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

export default function GISMapCanvas({
  project,
  geojson,
  loading,
  activeTool,
  setActiveTool,
  selectedId,
  selectFeature,
  workingCoords,
  moveVertex,
  commitVertexMove,
  setWorkingCoords,
  commitGeometryChange,
  isDraggingVertex,
  setIsDraggingVertex,
  addVertex,
  deleteVertex,
  compareMode,
  showOrtho,
  orthoOpacity,
  showBuildings,
  buildingsOpacity,
  visMode,
  onCursorMove,
  onZoomChange,
  onMapInit,
  scribbleClass = "tree",
}: GISMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [viewportNonce, setViewportNonce] = useState(0);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);

  // Measurement states
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);
  const [measureHoverPt, setMeasureHoverPt] = useState<[number, number] | null>(null);
  const [measureResult, setMeasureResult] = useState<{ value: number; type: "distance" | "area" } | null>(null);

  // Reset measurement state when activeTool changes
  useEffect(() => {
    if (activeTool !== "measure_distance" && activeTool !== "measure_area") {
      setMeasurePts([]);
      setMeasureHoverPt(null);
      setMeasureResult(null);
    }
  }, [activeTool]);
  const drawingPointsRef = useRef<[number, number][]>([]);
  const drawStartLngLatRef = useRef<[number, number] | null>(null);

  // Drag handles state
  const [dragState, setDragState] = useState<{
    type: "move" | "resize" | "rotate" | "vertex" | "midpoint" | "radius" | "center";
    handleId?: string;
    startX: number;
    startY: number;
    startLngLat: [number, number];
    initialCoords: number[][][];
    extraIndex?: number;
  } | null>(null);

  const activeToolRef = useRef(activeTool);
  const selectedIdRef = useRef(selectedId);
  const workingCoordsRef = useRef(workingCoords);
  const isDraggingVertexRef = useRef(isDraggingVertex);
  const selectFeatureRef = useRef(selectFeature);
  const setActiveToolRef = useRef(setActiveTool);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { workingCoordsRef.current = workingCoords; }, [workingCoords]);
  useEffect(() => { isDraggingVertexRef.current = isDraggingVertex; }, [isDraggingVertex]);
  useEffect(() => { selectFeatureRef.current = selectFeature; }, [selectFeature]);
  useEffect(() => { setActiveToolRef.current = setActiveTool; }, [setActiveTool]);

  // Centroid helper
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

  // Derive bounding box for fit bounds
  const computedBounds = useMemo((): number[] => {
    if (project.bounds && (project.bounds.length === 4 || project.bounds.length === 8)) {
      return project.bounds;
    }
    if (!geojson || geojson.features.length === 0) return [78.0, 30.0, 78.1, 30.1];
    
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    let valid = false;
    geojson.features.forEach((f) => {
      if (f.geometry && f.geometry.type === "Polygon") {
        const ring = f.geometry.coordinates[0];
        if (ring) {
          (ring as any).forEach((c: any) => {
            if (c[0] < minLng) minLng = c[0];
            if (c[0] > maxLng) maxLng = c[0];
            if (c[1] < minLat) minLat = c[1];
            if (c[1] > maxLat) maxLat = c[1];
            valid = true;
          });
        }
      }
    });
    return (valid ? [minLng, minLat, maxLng, maxLat] : [78.0, 30.0, 78.1, 30.1]) as [number, number, number, number];
  }, [geojson, project]);

  // Compile vertex markers GeoJSON for Point layer (unused in custom SVG overlay, but kept for compatibility)
  const vertexGeoJSON = useMemo(() => {
    return { type: "FeatureCollection", features: [] };
  }, []);

  // Compile comparison ghost geometry for compare mode
  const compareGeoJSON = useMemo(() => {
    if (!compareMode || !selectedId || !geojson) return { type: "FeatureCollection", features: [] };
    const feature = geojson.features.find((f) => f.properties.building_id === selectedId);
    if (!feature) return { type: "FeatureCollection", features: [] };
    return {
      type: "FeatureCollection",
      features: [
        {
          ...feature,
          properties: {
            ...feature.properties,
            is_ghost: true,
          },
        },
      ],
    };
  }, [compareMode, selectedId, geojson]);

  // Project coordinates helper for selected shape
  const selectedFeatureProps = useMemo(() => {
    if (!selectedId || !workingCoords || !mapReady || !mapRef.current) return null;
    const map = mapRef.current;
    
    const ring = workingCoords[0];
    if (!ring || ring.length === 0) return null;
    
    const screenPts = ring.map((c) => {
      const p = map.project(new LngLat(c[0], c[1]));
      return { x: p.x, y: p.y, lng: c[0], lat: c[1] };
    });
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    screenPts.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    });
    
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    
    const bufferEntry = geojson?.features.find((f) => f.properties.building_id === selectedId);
    const isLocked = bufferEntry?.properties?.is_locked || false;
    const isVisible = bufferEntry?.properties?.is_visible !== false;
    const shapeType = bufferEntry?.properties?.shape_type || "polygon";
    const radius = bufferEntry?.properties?.radius;
    
    return {
      screenPts,
      minX,
      minY,
      maxX,
      maxY,
      cx,
      cy,
      isLocked,
      isVisible,
      shapeType,
      radius,
    };
  }, [selectedId, workingCoords, geojson, mapReady, viewportNonce]);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

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
              "background-color": "#09090b",
            },
          },
        ],
      },
      center: [
        (computedBounds[0] + computedBounds[2]) / 2,
        (computedBounds[1] + computedBounds[3]) / 2,
      ],
      zoom: 18,
      maxZoom: 22,
    });

    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), "top-left");
    mapRef.current = map;

    map.on("load", () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const orthoUrl = `${baseUrl}/api/v1/projects/${project.id}/orthomosaic`;
      
      let coordinates: [[number, number], [number, number], [number, number], [number, number]];
      if (computedBounds.length === 8) {
        coordinates = [
          [computedBounds[0], computedBounds[1]],
          [computedBounds[2], computedBounds[3]],
          [computedBounds[4], computedBounds[5]],
          [computedBounds[6], computedBounds[7]],
        ];
      } else {
        coordinates = [
          [computedBounds[0], computedBounds[3]],
          [computedBounds[2], computedBounds[3]],
          [computedBounds[2], computedBounds[1]],
          [computedBounds[0], computedBounds[1]],
        ];
      }

      map.addSource("orthomosaic", {
        type: "image",
        url: orthoUrl,
        coordinates: coordinates,
      });

      map.addLayer({
        id: "orthomosaic-layer",
        type: "raster",
        source: "orthomosaic",
        paint: {
          "raster-opacity": showOrtho ? orthoOpacity : 0,
        },
      });

      // Buildings layers
      map.addSource("buildings", {
        type: "geojson",
        data: (geojson || { type: "FeatureCollection", features: [] }) as any,
      });

      map.addLayer({
        id: "buildings-fill",
        type: "fill",
        source: "buildings",
        paint: {
          "fill-color": ["coalesce", ["get", "fill"], "#3b82f6"],
          "fill-opacity": [
            "case",
            ["==", ["get", "is_visible"], false], 0,
            ["coalesce", ["get", "opacity"], 0.4]
          ],
        },
      });

      map.addLayer({
        id: "buildings-line",
        type: "line",
        source: "buildings",
        paint: {
          "line-color": ["coalesce", ["get", "stroke"], "#3b82f6"],
          "line-width": ["coalesce", ["get", "stroke_width"], 1.5],
          "line-opacity": [
            "case",
            ["==", ["get", "is_visible"], false], 0,
            0.8
          ],
        },
      });

      // Highlight outline
      map.addLayer({
        id: "buildings-highlight",
        type: "line",
        source: "buildings",
        paint: {
          "line-color": "#eab308",
          "line-width": 2.5,
          "line-opacity": 0.9,
        },
        filter: ["==", "building_id", ""],
      });

      // Ghost comparison layer
      map.addSource("compare-ghost", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "compare-ghost-line",
        type: "line",
        source: "compare-ghost",
        paint: {
          "line-color": "#ef4444",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      // Temp Drawing layer
      map.addSource("drawing-temp", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "drawing-temp-fill",
        type: "fill",
        source: "drawing-temp",
        paint: {
          "fill-color": "#fbbf24",
          "fill-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "drawing-temp-line",
        type: "line",
        source: "drawing-temp",
        paint: {
          "line-color": "#fbbf24",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      // Event listeners
      map.on("zoom", () => {
        onZoomChange(map.getZoom());
        setViewportNonce((n) => n + 1);
      });

      map.on("move", () => {
        setViewportNonce((n) => n + 1);
      });

      map.on("mousemove", (e) => {
        onCursorMove(e.lngLat.lng, e.lngLat.lat);
      });

      // Click select
      map.on("click", (e) => {
        const tool = activeToolRef.current;
        if (tool.startsWith("draw_") || isDrawing) return;

        const features = map.queryRenderedFeatures(e.point, { layers: ["buildings-fill", "buildings-line"] });
        if (features && features.length > 0) {
          const bid = features[0].properties.building_id;
          selectFeatureRef.current(bid);
        } else {
          selectFeatureRef.current(null);
        }
      });

      // Double-click to select and start editing vertices immediately
      map.on("dblclick", (e) => {
        const tool = activeToolRef.current;
        if (tool.startsWith("draw_") || isDrawing) return;

        const features = map.queryRenderedFeatures(e.point, { layers: ["buildings-fill", "buildings-line"] });
        if (features && features.length > 0) {
          e.preventDefault();
          const bid = features[0].properties.building_id;
          selectFeatureRef.current(bid);
          setActiveToolRef.current("vertex_edit");
        }
      });

      onMapInit(map);
      setMapReady(true);
      onZoomChange(map.getZoom());

      let bbox: [number, number, number, number];
      if (computedBounds.length === 8) {
        const xs = [computedBounds[0], computedBounds[2], computedBounds[4], computedBounds[6]];
        const ys = [computedBounds[1], computedBounds[3], computedBounds[5], computedBounds[7]];
        bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      } else {
        bbox = [computedBounds[0], computedBounds[1], computedBounds[2], computedBounds[3]] as [number, number, number, number];
      }
      
      map.fitBounds(bbox, {
        padding: 50,
        maxZoom: 19,
        animate: false,
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [project.id]);

  // Sync selection highlight filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setFilter("buildings-highlight", ["==", "building_id", selectedId || ""]);
  }, [selectedId, mapReady]);

  // Sync buildings GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !geojson) return;
    const source = map.getSource("buildings") as GeoJSONSource;
    if (source) {
      source.setData(geojson as any);
    }
  }, [geojson, mapReady]);

  // Sync ghost comparison GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("compare-ghost") as GeoJSONSource;
    if (source) {
      source.setData(compareGeoJSON as any);
    }
  }, [compareGeoJSON, mapReady]);

  // Sync measurement paths to drawing-temp source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("drawing-temp") as GeoJSONSource;
    if (!source) return;

    if (activeTool !== "measure_distance" && activeTool !== "measure_area") return;

    if (measurePts.length === 0) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const pts = [...measurePts];
    if (measureHoverPt) {
      pts.push(measureHoverPt);
    }

    if (activeTool === "measure_area" && pts.length >= 3) {
      source.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [[...pts, pts[0]]]
          }
        }]
      });
    } else if (pts.length >= 2) {
      source.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: pts
          }
        }]
      });
    } else {
      source.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: pts[0]
          }
        }]
      });
    }
  }, [measurePts, measureHoverPt, activeTool, mapReady]);

  // Sync layer toggles & opacities
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.getLayer("orthomosaic-layer")) {
      map.setPaintProperty("orthomosaic-layer", "raster-opacity", showOrtho ? orthoOpacity : 0);
    }
    if (map.getLayer("buildings-fill")) {
      map.setPaintProperty("buildings-fill", "fill-opacity", [
        "case",
        ["==", ["get", "is_visible"], false], 0,
        ["coalesce", ["get", "opacity"], 0.4]
      ]);
    }
    if (map.getLayer("buildings-line")) {
      map.setPaintProperty("buildings-line", "line-opacity", [
        "case",
        ["==", ["get", "is_visible"], false], 0,
        0.8
      ]);
    }
  }, [showOrtho, orthoOpacity, showBuildings, buildingsOpacity, mapReady]);

  // Sync visual modes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (visMode === "confidence") {
      map.setPaintProperty("buildings-fill", "fill-color", [
        "step",
        ["get", "confidence"],
        "#a83c1c",
        0.5,
        "#b9820a",
        0.8,
        "#1f7a4d",
      ]);
      map.setPaintProperty("buildings-line", "line-color", [
        "step",
        ["get", "confidence"],
        "#a83c1c",
        0.5,
        "#b9820a",
        0.8,
        "#1f7a4d",
      ]);
    } else if (visMode === "review") {
      map.setPaintProperty("buildings-fill", "fill-color", [
        "match",
        ["get", "review_status"],
        "APPROVED", "#1f7a4d",
        "approved", "#1f7a4d",
        "CREATED", "#eab308",
        "created", "#eab308",
        "EDITED", "#2f6fb0",
        "edited", "#2f6fb0",
        "REJECTED", "#a83c1c",
        "rejected", "#a83c1c",
        "#b9820a",
      ]);
      map.setPaintProperty("buildings-line", "line-color", [
        "match",
        ["get", "review_status"],
        "APPROVED", "#1f7a4d",
        "approved", "#1f7a4d",
        "CREATED", "#eab308",
        "created", "#eab308",
        "EDITED", "#2f6fb0",
        "edited", "#2f6fb0",
        "REJECTED", "#a83c1c",
        "rejected", "#a83c1c",
        "#b9820a",
      ]);
    } else {
      map.setPaintProperty("buildings-fill", "fill-color", ["coalesce", ["get", "fill"], "#3b82f6"]);
      map.setPaintProperty("buildings-line", "line-color", ["coalesce", ["get", "stroke"], "#3b82f6"]);
    }
  }, [visMode, mapReady]);

  // Sync cursor & map dragPan
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const canvas = map.getCanvas();
    if (activeTool === "pan") {
      map.dragPan.enable();
      canvas.style.cursor = "grab";
    } else if (activeTool.startsWith("draw_") || activeTool === "scribble") {
      map.dragPan.disable();
      canvas.style.cursor = "crosshair";
    } else {
      map.dragPan.enable();
      canvas.style.cursor = "default";
    }
  }, [activeTool, mapReady]);

  // Handle drawing events on map canvas
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMouseDown = (e: any) => {
      const tool = activeToolRef.current;
      if (tool !== "draw_rect" && tool !== "draw_circle" && tool !== "scribble") return;

      e.preventDefault();
      setIsDrawing(true);
      drawStartLngLatRef.current = [e.lngLat.lng, e.lngLat.lat];
      if (tool === "scribble") {
        drawingPointsRef.current = [[e.lngLat.lng, e.lngLat.lat]];
      }
    };

    const handleMouseMove = (e: any) => {
      if (!isDrawing || !drawStartLngLatRef.current) return;
      const tool = activeToolRef.current;
      const start = drawStartLngLatRef.current;
      const curr: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      const source = map.getSource("drawing-temp") as GeoJSONSource;
      if (!source) return;

      if (tool === "draw_rect") {
        const coords = [[
          [start[0], start[1]],
          [curr[0], start[1]],
          [curr[0], curr[1]],
          [start[0], curr[1]],
          [start[0], start[1]]
        ]];
        source.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: coords }
          }]
        });
      } else if (tool === "draw_circle") {
        const dist = turf.distance(start, curr, { units: "meters" });
        const circleFeature = turf.circle(start, dist, { steps: 64, units: "meters" });
        source.setData({
          type: "FeatureCollection",
          features: [circleFeature as any]
        });
      } else if (tool === "scribble") {
        drawingPointsRef.current.push(curr);
        source.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: drawingPointsRef.current }
          }]
        });
      }
    };

    const handleMouseUp = (e: any) => {
      if (!isDrawing || !drawStartLngLatRef.current) return;
      const tool = activeToolRef.current;
      const start = drawStartLngLatRef.current;
      const curr: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      const source = map.getSource("drawing-temp") as GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }

      setIsDrawing(false);
      drawStartLngLatRef.current = null;

      if (tool === "draw_rect") {
        const coords = [[
          [start[0], start[1]],
          [curr[0], start[1]],
          [curr[0], curr[1]],
          [start[0], curr[1]],
          [start[0], start[1]]
        ]];
        const area = turf.area(turf.polygon(coords));
        (window as any).nextGISEditor?.createFeature("rectangle", {
          type: "Polygon",
          coordinates: coords
        }, { area });
      } else if (tool === "draw_circle") {
        const radius = turf.distance(start, curr, { units: "meters" });
        const circleFeature = turf.circle(start, radius, { steps: 64, units: "meters" });
        const area = turf.area(circleFeature);
        (window as any).nextGISEditor?.createFeature("circle", circleFeature.geometry, {
          radius: radius,
          center: start,
          area
        });
      } else if (tool === "scribble") {
        const pts = drawingPointsRef.current;
        drawingPointsRef.current = [];
        if (pts.length < 3) return;

        // Determine if lasso closed-loop or single paint stroke
        const startPt = pts[0];
        const endPt = pts[pts.length - 1];
        const dist = turf.distance(startPt, endPt, { units: "meters" });
        const isClosedLoop = dist < 12; // If start & end are within 12 meters, consider it a lasso boundary

        if (scribbleClass === "tree") {
          let geom: any = null;
          let area = 0;
          let name = "Tree Footprint";

          if (isClosedLoop) {
            // Photoshop Lasso Type: make closed polygon
            try {
              const poly = turf.polygon([[...pts, pts[0]]]);
              const simplified = turf.simplify(poly, { tolerance: 0.000015, highQuality: true });
              geom = simplified.geometry;
              area = turf.area(simplified);
              name = "Greenery Canopy";
            } catch (err) {
              const poly = turf.polygon([[...pts, pts[0]]]);
              geom = poly.geometry;
              area = turf.area(poly);
            }
          } else {
            // Paint Brush Type: buffer the stroke line by 5 meters to auto-fit tree area
            try {
              const line = turf.lineString(pts);
              const buffered = turf.buffer(line, 5, { units: "meters" });
              if (buffered) {
                geom = buffered.geometry;
                area = turf.area(buffered);
              }
            } catch (err) {
              // fallback circular fit
              let sumLng = 0, sumLat = 0;
              pts.forEach((pt) => { sumLng += pt[0]; sumLat += pt[1]; });
              const center: [number, number] = [sumLng / pts.length, sumLat / pts.length];
              let sumD = 0;
              pts.forEach((pt) => { sumD += turf.distance(center, pt, { units: "meters" }); });
              const r = sumD / pts.length;
              const circleFeature = turf.circle(center, r, { steps: 64, units: "meters" });
              geom = circleFeature.geometry;
              area = turf.area(circleFeature);
            }
          }

          if (geom) {
            (window as any).nextGISEditor?.createFeature("polygon", geom, {
              area,
              name,
              fill: "#10b981", // Greenery paint color
              stroke: "#059669",
              opacity: 0.5,
              stroke_width: 1.5
            });
          }
        } else if (scribbleClass === "road") {
          let geom: any = null;
          let area = 0;

          if (isClosedLoop) {
            // Photoshop Lasso Type: road boundary selection
            try {
              const poly = turf.polygon([[...pts, pts[0]]]);
              const simplified = turf.simplify(poly, { tolerance: 0.000015, highQuality: true });
              geom = simplified.geometry;
              area = turf.area(simplified);
            } catch (err) {
              const poly = turf.polygon([[...pts, pts[0]]]);
              geom = poly.geometry;
              area = turf.area(poly);
            }
          } else {
            // Centerline Paint Stroke: buffer centerline by 4.5m (9m wide road overlay)
            try {
              const line = turf.lineString(pts);
              const simplified = turf.simplify(line, { tolerance: 0.00001, highQuality: true });
              const buffered = turf.buffer(simplified, 4.5, { units: "meters" });
              if (buffered) {
                geom = buffered.geometry;
                area = turf.area(buffered);
              }
            } catch (err) {
              const line = turf.lineString(pts);
              const buffered = turf.buffer(line, 4.5, { units: "meters" });
              if (buffered) {
                geom = buffered.geometry;
                area = turf.area(buffered);
              }
            }
          }

          if (geom) {
            (window as any).nextGISEditor?.createFeature("polygon", geom, {
              area,
              name: "Road Section",
              fill: "#f59e0b", // Road yellow color
              stroke: "#d97706",
              opacity: 0.45,
              stroke_width: 2.0
            });
          }
        }
      }
    };

    const handleMapClick = (e: any) => {
      const tool = activeToolRef.current;
      if (tool === "measure_distance" || tool === "measure_area") {
        const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setMeasureResult(null);
        setMeasurePts((prev) => {
          if (prev.length === 0) {
            setMeasureHoverPt(pt);
          }
          return [...prev, pt];
        });
        return;
      }

      if (tool !== "draw_poly" && tool !== "draw_line") return;

      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (drawingPointsRef.current.length === 0) {
        setIsDrawing(true);
        drawingPointsRef.current = [pt, pt]; // add placeholder last segment
      } else {
        // replace last placeholder with real point, and add new placeholder
        const pts = [...drawingPointsRef.current];
        pts[pts.length - 1] = pt;
        pts.push(pt);
        drawingPointsRef.current = pts;
      }
    };

    const handleMapMouseMove = (e: any) => {
      const tool = activeToolRef.current;
      if (tool === "measure_distance" || tool === "measure_area") {
        setMeasureHoverPt([e.lngLat.lng, e.lngLat.lat]);
        return;
      }

      if ((tool !== "draw_poly" && tool !== "draw_line") || !isDrawing) return;

      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const pts = [...drawingPointsRef.current];
      pts[pts.length - 1] = pt; // update last point to follow cursor

      const source = map.getSource("drawing-temp") as GeoJSONSource;
      if (!source) return;

      if (tool === "draw_poly" && pts.length >= 3) {
        // close ring for visualization
        const closed = [...pts, pts[0]];
        source.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [closed] }
          }]
        });
      } else {
        source.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: pts }
          }]
        });
      }
    };

    const handleMapDblClick = (e: any) => {
      const tool = activeToolRef.current;
      if (tool === "measure_distance" || tool === "measure_area") {
        e.preventDefault();
        
        setMeasurePts((prev) => {
          if (prev.length === 0) return prev;
          
          const finalPts = [...prev];
          if (tool === "measure_distance") {
            try {
              if (finalPts.length >= 2) {
                const line = turf.lineString(finalPts);
                const dist = turf.length(line, { units: "meters" });
                setMeasureResult({ value: dist, type: "distance" });
              }
            } catch (err) {}
          } else {
            if (finalPts.length >= 3) {
              try {
                const poly = turf.polygon([[...finalPts, finalPts[0]]]);
                const area = turf.area(poly);
                setMeasureResult({ value: area, type: "area" });
              } catch (err) {}
            }
          }
          
          return [];
        });
        
        setMeasureHoverPt(null);
        return;
      }

      if (tool !== "draw_poly" && tool !== "draw_line") return;

      e.preventDefault();
      const pts = [...drawingPointsRef.current];
      // remove the trailing placeholder
      pts.pop();

      const source = map.getSource("drawing-temp") as GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }

      setIsDrawing(false);
      drawingPointsRef.current = [];

      if (pts.length < 2) return;

      if (tool === "draw_poly") {
        if (pts.length < 3) return;
        const coords = [[...pts, pts[0]]];
        const area = turf.area(turf.polygon(coords));
        (window as any).nextGISEditor?.createFeature("polygon", {
          type: "Polygon",
          coordinates: coords
        }, { area });
      } else if (tool === "draw_line") {
        const length = turf.length(turf.lineString(pts), { units: "kilometers" }) * 1000;
        (window as any).nextGISEditor?.createFeature("line", {
          type: "LineString",
          coordinates: [pts] // wrapped in array to fit workingCoords nesting
        }, { area: length }); // store length as area metric
      }
    };

    map.on("mousedown", handleMouseDown);
    map.on("mousemove", handleMouseMove);
    map.on("mouseup", handleMouseUp);
    map.on("click", handleMapClick);
    map.on("mousemove", handleMapMouseMove);
    map.on("dblclick", handleMapDblClick);

    return () => {
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMove);
      map.off("mouseup", handleMouseUp);
      map.off("click", handleMapClick);
      map.off("mousemove", handleMapMouseMove);
      map.off("dblclick", handleMapDblClick);
    };
  }, [mapReady, isDrawing]);

  // Handle pointer down on handles
  const handlePointerDown = (
    e: React.PointerEvent<SVGElement | SVGCircleElement | SVGRectElement>,
    type: "move" | "resize" | "rotate" | "vertex" | "midpoint" | "radius" | "center",
    extraIndex?: any
  ) => {
    if (!selectedId || !workingCoords || !mapRef.current) return;
    const map = mapRef.current;
    
    e.preventDefault();
    e.stopPropagation();

    // Disable map dragging
    map.dragPan.disable();

    const target = e.currentTarget as any;
    target.setPointerCapture(e.pointerId);

    const clientX = e.clientX;
    const clientY = e.clientY;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    const relativeX = clientX - (rect?.left || 0);
    const relativeY = clientY - (rect?.top || 0);
    
    const startLngLat = map.unproject([relativeX, relativeY]);

    // Handle midpoint creation immediately on mousedown
    if (type === "midpoint") {
      const idx = extraIndex as number;
      const ring = workingCoords[0];
      const ptA = ring[idx];
      const ptB = ring[idx + 1] || ring[0];
      const midLng = (ptA[0] + ptB[0]) / 2;
      const midLat = (ptA[1] + ptB[1]) / 2;

      // Insert vertex
      addVertex(selectedId, 0, idx, midLng, midLat);

      // Start vertex dragging on the new vertex index
      const newVertexIdx = idx + 1;
      setDragState({
        type: "vertex",
        extraIndex: newVertexIdx,
        startX: clientX,
        startY: clientY,
        startLngLat: [startLngLat.lng, startLngLat.lat],
        initialCoords: JSON.parse(JSON.stringify(workingCoords)),
      });
      setIsDraggingVertex(true);
      return;
    }

    setDragState({
      type,
      handleId: extraIndex as string, // for resize handle names
      startX: clientX,
      startY: clientY,
      startLngLat: [startLngLat.lng, startLngLat.lat],
      initialCoords: JSON.parse(JSON.stringify(workingCoords)),
      extraIndex: typeof extraIndex === "number" ? extraIndex : undefined, // for vertex indices
    });

    if (type === "vertex") {
      setIsDraggingVertex(true);
    }
  };

  // Bind nextGISEditor to window for map drawing hooks
  useEffect(() => {
    (window as any).nextGISEditor = {
      createFeature: (type: string, geometry: any, properties: any) => {
        // Fallback placeholder area calculation
        let area = properties?.area || 0;
        if (geometry.type === "Polygon" && area === 0) {
          area = turf.area(geometry);
        }
        (window as any).nextGISEditorInstance?.createFeature(type, geometry, { ...properties, area });
      },
      updateFeatureProperties: (id: string, props: any) => {
        (window as any).nextGISEditorInstance?.updateFeatureProperties(id, props);
      }
    };
    return () => {
      (window as any).nextGISEditor = null;
    };
  }, []);

  // Global document drag listeners to reliably track movement even with pointer-events-none SVG overlay
  useEffect(() => {
    if (!dragState || !selectedId || !workingCoords || !mapRef.current || !selectedFeatureProps) return;
    const map = mapRef.current;

    const handleGlobalPointerMove = (e: PointerEvent) => {
      const clientX = e.clientX;
      const clientY = e.clientY;
      const rect = mapContainerRef.current?.getBoundingClientRect();
      const mouseX = clientX - (rect?.left || 0);
      const mouseY = clientY - (rect?.top || 0);

      const currLngLat = map.unproject([mouseX, mouseY]);
      const dLng = currLngLat.lng - dragState.startLngLat[0];
      const dLat = currLngLat.lat - dragState.startLngLat[1];

      let newCoords = JSON.parse(JSON.stringify(dragState.initialCoords)) as number[][][];

      if (dragState.type === "move" || dragState.type === "center") {
        newCoords = newCoords.map((ring) =>
          ring.map((c) => [c[0] + dLng, c[1] + dLat])
        );
        setWorkingCoords(selectedId, newCoords);
      } else if (dragState.type === "vertex" && dragState.extraIndex !== undefined) {
        const idx = dragState.extraIndex;
        moveVertex(selectedId, 0, idx, currLngLat.lng, currLngLat.lat);
      } else if (dragState.type === "radius") {
        const center = getCentroid(dragState.initialCoords);
        const newRadius = turf.distance(center, [currLngLat.lng, currLngLat.lat], { units: "meters" });
        const regenerated = generateCircleCoords(center, newRadius);
        setWorkingCoords(selectedId, regenerated);
        (window as any).nextGISEditor?.updateFeatureProperties(selectedId, { radius: newRadius });
      } else if (dragState.type === "rotate") {
        const center = getCentroid(dragState.initialCoords);
        const centerScreen = map.project(new LngLat(center[0], center[1]));
        
        const startAngle = Math.atan2(dragState.startY - centerScreen.y, dragState.startX - centerScreen.x);
        const currAngle = Math.atan2(clientY - centerScreen.y, clientX - centerScreen.x);
        const dAngle = currAngle - startAngle;

        const cosA = Math.cos(dAngle);
        const sinA = Math.sin(dAngle);

        newCoords = newCoords.map((ring) =>
          ring.map((c) => {
            const ptScreen = map.project(new LngLat(c[0], c[1]));
            const dx = ptScreen.x - centerScreen.x;
            const dy = ptScreen.y - centerScreen.y;
            const rx = centerScreen.x + dx * cosA - dy * sinA;
            const ry = centerScreen.y + dx * sinA + dy * cosA;
            const unproj = map.unproject([rx, ry]);
            return [unproj.lng, unproj.lat];
          })
        );
        setWorkingCoords(selectedId, newCoords);
      } else if (dragState.type === "resize" && dragState.handleId) {
        const center = getCentroid(dragState.initialCoords);
        const centerScreen = map.project(new LngLat(center[0], center[1]));
        
        const initialBBox = dragState.initialCoords[0].reduce(
          (acc, c) => {
            const p = map.project(new LngLat(c[0], c[1]));
            return {
              minX: Math.min(acc.minX, p.x),
              minY: Math.min(acc.minY, p.y),
              maxX: Math.max(acc.maxX, p.x),
              maxY: Math.max(acc.maxY, p.y),
            };
          },
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        );

        let anchorX = centerScreen.x;
        let anchorY = centerScreen.y;
        
        const handle = dragState.handleId;
        if (handle === "tl") { anchorX = initialBBox.maxX; anchorY = initialBBox.maxY; }
        else if (handle === "tr") { anchorX = initialBBox.minX; anchorY = initialBBox.maxY; }
        else if (handle === "bl") { anchorX = initialBBox.maxX; anchorY = initialBBox.minY; }
        else if (handle === "br") { anchorX = initialBBox.minX; anchorY = initialBBox.minY; }
        else if (handle === "t") { anchorY = initialBBox.maxY; }
        else if (handle === "b") { anchorY = initialBBox.minY; }
        else if (handle === "l") { anchorX = initialBBox.maxX; }
        else if (handle === "r") { anchorX = initialBBox.minX; }

        const startOffsetDragX = dragState.startX - (rect?.left || 0);
        const startOffsetDragY = dragState.startY - (rect?.top || 0);
        
        const initialDistX = startOffsetDragX - anchorX;
        const initialDistY = startOffsetDragY - anchorY;

        let scaleX = initialDistX !== 0 ? (mouseX - anchorX) / initialDistX : 1.0;
        let scaleY = initialDistY !== 0 ? (mouseY - anchorY) / initialDistY : 1.0;

        if (handle === "t" || handle === "b") scaleX = 1.0;
        if (handle === "l" || handle === "r") scaleY = 1.0;

        if (e.shiftKey && handle !== "t" && handle !== "b" && handle !== "l" && handle !== "r") {
          const scale = Math.max(Math.abs(scaleX), Math.abs(scaleY)) * (Math.sign(scaleX) === Math.sign(scaleY) ? 1 : -1);
          scaleX = scale;
          scaleY = scale;
        }

        newCoords = newCoords.map((ring) =>
          ring.map((c) => {
            const ptScreen = map.project(new LngLat(c[0], c[1]));
            const rx = anchorX + (ptScreen.x - anchorX) * scaleX;
            const ry = anchorY + (ptScreen.y - anchorY) * scaleY;
            const unproj = map.unproject([rx, ry]);
            return [unproj.lng, unproj.lat];
          })
        );
        setWorkingCoords(selectedId, newCoords);
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (activeTool === "pan" || activeTool === "select" || activeTool === "vertex_edit") {
        map.dragPan.enable();
      }

      if (dragState.type === "vertex") {
        setIsDraggingVertex(false);
        commitVertexMove(selectedId, dragState.initialCoords);
      } else {
        const commandType =
          dragState.type === "move"
            ? "MOVE_GEOMETRY"
            : dragState.type === "resize"
            ? "SCALE_GEOMETRY"
            : dragState.type === "rotate"
            ? "ROTATE_GEOMETRY"
            : dragState.type === "center"
            ? "MOVE_GEOMETRY"
            : dragState.type === "radius"
            ? "SCALE_GEOMETRY"
            : "NUDGE_GEOMETRY";
        commitGeometryChange(selectedId, dragState.initialCoords, commandType);
      }

      setDragState(null);
    };

    document.addEventListener("pointermove", handleGlobalPointerMove);
    document.addEventListener("pointerup", handleGlobalPointerUp);

    return () => {
      document.removeEventListener("pointermove", handleGlobalPointerMove);
      document.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, [dragState, selectedId, workingCoords, selectedFeatureProps, mapReady, activeTool, commitGeometryChange, commitVertexMove, moveVertex, setWorkingCoords, setIsDraggingVertex]);

  return (
    <div className="flex-1 h-full relative min-h-[300px]" ref={mapContainerRef}>
      {loading && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center gap-2 z-40">
          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
          <span className="text-zinc-400 text-xs font-semibold">Syncing spatial workspace...</span>
        </div>
      )}
      
      {/* SVG Interactive Handles Layer */}
      {mapReady && selectedId && workingCoords && selectedFeatureProps && selectedFeatureProps.isVisible && (
        <div className="absolute inset-0 pointer-events-none select-none z-10">
          <svg
            className="w-full h-full pointer-events-none"
          >
            {/* 1. Bounding Box & Resizer Handles (for Rectangles/Polygons/Lines) */}
            {selectedFeatureProps.shapeType !== "circle" && !selectedFeatureProps.isLocked && (activeTool === "select" || activeTool === "move" || activeTool === "scale" || activeTool === "rotate") && (
              <>
                {/* Bounding box dashes */}
                <rect
                  x={selectedFeatureProps.minX}
                  y={selectedFeatureProps.minY}
                  width={selectedFeatureProps.maxX - selectedFeatureProps.minX}
                  height={selectedFeatureProps.maxY - selectedFeatureProps.minY}
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="1.25"
                  strokeDasharray="3 3"
                />

                {/* Invisible shape fill overlay to easily drag translate shape */}
                {selectedFeatureProps.shapeType === "polygon" && (
                  <polygon
                    points={selectedFeatureProps.screenPts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="transparent"
                    style={{ cursor: "move", pointerEvents: "auto" }}
                    onPointerDown={(e) => handlePointerDown(e, "move")}
                  />
                )}
                {selectedFeatureProps.shapeType === "line" && (
                  <polyline
                    points={selectedFeatureProps.screenPts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    style={{ cursor: "move", pointerEvents: "auto" }}
                    onPointerDown={(e) => handlePointerDown(e, "move")}
                  />
                )}

                {/* Rotation Line and Handle */}
                {selectedFeatureProps.shapeType !== "line" && (
                  <>
                    <line
                      x1={selectedFeatureProps.cx}
                      y1={selectedFeatureProps.minY}
                      x2={selectedFeatureProps.cx}
                      y2={selectedFeatureProps.minY - 25}
                      stroke="#eab308"
                      strokeWidth="1.25"
                    />
                    <circle
                      cx={selectedFeatureProps.cx}
                      cy={selectedFeatureProps.minY - 25}
                      r="6.5"
                      fill="#ffffff"
                      stroke="#eab308"
                      strokeWidth="2.25"
                      style={{ cursor: "grab", pointerEvents: "auto" }}
                      onPointerDown={(e) => handlePointerDown(e, "rotate")}
                    >
                      <title>Drag to rotate shape</title>
                    </circle>
                  </>
                )}

                {/* Corner resize handles */}
                <rect x={selectedFeatureProps.minX - 4} y={selectedFeatureProps.minY - 4} width="8" height="8" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" style={{ cursor: "nwse-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "resize", "tl")} />
                <rect x={selectedFeatureProps.maxX - 4} y={selectedFeatureProps.minY - 4} width="8" height="8" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" style={{ cursor: "nesw-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "resize", "tr")} />
                <rect x={selectedFeatureProps.minX - 4} y={selectedFeatureProps.maxY - 4} width="8" height="8" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" style={{ cursor: "nesw-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "resize", "bl")} />
                <rect x={selectedFeatureProps.maxX - 4} y={selectedFeatureProps.maxY - 4} width="8" height="8" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" style={{ cursor: "nwse-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "resize", "br")} />

                {/* Edge resize handles */}
                <rect x={(selectedFeatureProps.minX+selectedFeatureProps.maxX)/2 - 4} y={selectedFeatureProps.minY - 4} width="8" height="8" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" style={{ cursor: "ns-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "resize", "t")} />
                <rect x={(selectedFeatureProps.minX+selectedFeatureProps.maxX)/2 - 4} y={selectedFeatureProps.maxY - 4} width="8" height="8" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" style={{ cursor: "ns-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "resize", "b")} />
                <rect x={selectedFeatureProps.minX - 4} y={(selectedFeatureProps.minY+selectedFeatureProps.maxY)/2 - 4} width="8" height="8" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" style={{ cursor: "ew-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "resize", "l")} />
                <rect x={selectedFeatureProps.maxX - 4} y={(selectedFeatureProps.minY+selectedFeatureProps.maxY)/2 - 4} width="8" height="8" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" style={{ cursor: "ew-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "resize", "r")} />
              </>
            )}

            {/* 2. Vertex Handles & Edge Midpoints (for Vertex Editing Mode) */}
            {activeTool === "vertex_edit" && !selectedFeatureProps.isLocked && (
              <>
                {/* Vertex edit handles */}
                {selectedFeatureProps.screenPts.slice(0, selectedFeatureProps.shapeType === "line" ? undefined : -1).map((pt, idx) => (
                  <circle
                    key={`vertex-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="6.5"
                    fill="#fbbf24"
                    stroke="#000000"
                    strokeWidth="1.5"
                    style={{ cursor: "pointer", pointerEvents: "auto" }}
                    onPointerDown={(e) => handlePointerDown(e, "vertex", idx)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Right click to delete vertex
                      const minLen = selectedFeatureProps.shapeType === "line" ? 2 : 4;
                      if (workingCoords[0].length > minLen) {
                        (window as any).nextGISEditorInstance?.deleteVertex(selectedId, 0, idx);
                      }
                    }}
                  >
                    <title>Drag to adjust, Right-click to delete</title>
                  </circle>
                ))}

                {/* Edge midpoint addition handles */}
                {selectedFeatureProps.shapeType !== "circle" && selectedFeatureProps.screenPts.slice(0, -1).map((pt, idx) => {
                  const nextPt = selectedFeatureProps.screenPts[idx + 1] || selectedFeatureProps.screenPts[0];
                  const midX = (pt.x + nextPt.x) / 2;
                  const midY = (pt.y + nextPt.y) / 2;
                  return (
                    <circle
                      key={`midpoint-${idx}`}
                      cx={midX}
                      cy={midY}
                      r="4.5"
                      fill="#eab308"
                      fillOpacity="0.6"
                      stroke="#000000"
                      strokeWidth="1"
                      style={{ cursor: "copy", pointerEvents: "auto" }}
                      onPointerDown={(e) => handlePointerDown(e, "midpoint", idx)}
                    >
                      <title>Drag to add vertex</title>
                    </circle>
                  );
                })}
              </>
            )}

            {/* 3. Circle Handles (Center move, radius perimeter adjust) */}
            {selectedFeatureProps.shapeType === "circle" && !selectedFeatureProps.isLocked && (activeTool === "select" || activeTool === "move" || activeTool === "scale" || activeTool === "rotate") && (
              <>
                {/* Center marker */}
                <circle
                  cx={selectedFeatureProps.cx}
                  cy={selectedFeatureProps.cy}
                  r="7"
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{ cursor: "move", pointerEvents: "auto" }}
                  onPointerDown={(e) => handlePointerDown(e, "center")}
                >
                  <title>Drag center to translate Circle</title>
                </circle>

                {/* Radius line and handle */}
                {(() => {
                  const centerLngLat = getCentroid(workingCoords);
                  const radius = selectedFeatureProps.radius || 10;
                  const rightLngLat = turf.destination(centerLngLat, radius, 90, { units: "meters" });
                  const rightPt = mapRef.current?.project(new LngLat(rightLngLat.geometry.coordinates[0], rightLngLat.geometry.coordinates[1])) || { x: 0, y: 0 };
                  return (
                    <>
                      <line
                        x1={selectedFeatureProps.cx}
                        y1={selectedFeatureProps.cy}
                        x2={rightPt.x}
                        y2={rightPt.y}
                        stroke="#eab308"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={rightPt.x}
                        cy={rightPt.y}
                        r="6.5"
                        fill="#fbbf24"
                        stroke="#000000"
                        strokeWidth="1.75"
                        style={{ cursor: "ew-resize", pointerEvents: "auto" }}
                        onPointerDown={(e) => handlePointerDown(e, "radius")}
                      >
                        <title>Drag to resize radius</title>
                      </circle>
                      {/* Radius value label */}
                      <g style={{ pointerEvents: "none" }}>
                        <rect
                          x={rightPt.x + 8}
                          y={rightPt.y - 12}
                          width="70"
                          height="18"
                          rx="3"
                          fill="#09090b"
                          stroke="#27272a"
                          strokeWidth="1"
                        />
                        <text
                          x={rightPt.x + 13}
                          y={rightPt.y}
                          fill="#fbbf24"
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          R:{radius.toFixed(1)}m
                        </text>
                      </g>
                    </>
                  );
                })()}
              </>
            )}
          </svg>
        </div>
      )}

      {/* 4. Measurement Tooltips & SVG nodes */}
      {mapReady && (activeTool === "measure_distance" || activeTool === "measure_area") && (
        <>
          {/* Live Tooltip at cursor */}
          {measureHoverPt && measurePts.length > 0 && (() => {
            const screenPt = mapRef.current?.project(new LngLat(measureHoverPt[0], measureHoverPt[1])) || { x: 0, y: 0 };
            let label = "";
            
            if (activeTool === "measure_distance") {
              try {
                const line = turf.lineString([...measurePts, measureHoverPt]);
                const dist = turf.length(line, { units: "kilometers" }) * 1000;
                label = `Distance: ${dist.toFixed(1)}m`;
              } catch(e) {}
            } else {
              if (measurePts.length >= 2) {
                try {
                  const poly = turf.polygon([[...measurePts, measureHoverPt, measurePts[0]]]);
                  const area = turf.area(poly);
                  label = `Area: ${area.toFixed(1)}m²`;
                } catch(e) {}
              } else {
                label = "Click to add corner";
              }
            }

            if (!label) return null;

            return (
              <div
                className="absolute bg-zinc-950/90 border border-zinc-800 text-yellow-400 font-mono text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none select-none z-20"
                style={{ left: screenPt.x + 12, top: screenPt.y - 12 }}
              >
                {label}
              </div>
            );
          })()}

          {/* Node circle points */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <svg className="w-full h-full pointer-events-none">
              {measurePts.map((pt, idx) => {
                const screenPt = mapRef.current?.project(new LngLat(pt[0], pt[1])) || { x: 0, y: 0 };
                return (
                  <circle
                    key={`measure-node-${idx}`}
                    cx={screenPt.x}
                    cy={screenPt.y}
                    r="5"
                    fill="#eab308"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          </div>
        </>
      )}

      {/* Completed Result Tooltip Banner */}
      {mapReady && measureResult && (() => {
        let valStr = "";
        if (measureResult.type === "distance") {
          const meters = measureResult.value * 1000;
          valStr = `${meters.toFixed(2)} meters`;
        } else {
          valStr = `${measureResult.value.toFixed(2)} m²`;
        }
        return (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-yellow-500/50 text-zinc-100 font-sans text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 z-30 animate-in fade-in-50 slide-in-from-top-2 duration-200 animate-bounce">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
            <span className="font-semibold text-zinc-300">
              Measurement Result:
            </span>
            <span className="font-bold text-yellow-400 font-mono text-sm">
              {valStr}
            </span>
            <button
              onClick={() => setMeasureResult(null)}
              className="text-zinc-500 hover:text-zinc-300 ml-1.5 p-0.5 rounded-full hover:bg-zinc-800 transition-colors pointer-events-auto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })()}

      {/* Mapbox container */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
