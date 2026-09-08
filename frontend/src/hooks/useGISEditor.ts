"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { GeoJSONFeature } from "@/types";
import { patchBuildingReview, createBuilding, deleteBuilding } from "@/lib/api/buildings";

// ─── Tool Definitions ───────────────────────────────────────────────
export type GISTool =
  | "select"
  | "pan"
  | "zoom_in"
  | "zoom_out"
  | "vertex_edit"
  | "move"
  | "scale"
  | "rotate"
  | "draw_rect"
  | "draw_poly"
  | "draw_line"
  | "draw_circle"
  | "scribble"
  | "measure_distance"
  | "measure_area"
  | "approve"
  | "reject"
  | "flag";

// ─── Edit Command (Undo/Redo) ───────────────────────────────────────
export interface EditCommand {
  type:
    | "MOVE_VERTEX"
    | "ADD_VERTEX"
    | "DELETE_VERTEX"
    | "MOVE_GEOMETRY"
    | "SCALE_GEOMETRY"
    | "ROTATE_GEOMETRY"
    | "NUDGE_GEOMETRY"
    | "APPROVE"
    | "REJECT"
    | "RESET_GEOMETRY"
    | "UPDATE_PROPERTIES"
    | "DELETE_FEATURE"
    | "CREATE_FEATURE";
  buildingId: string;
  before: any; // polygon coordinates snapshot or properties snapshot before
  after: any;  // polygon coordinates snapshot or properties snapshot after
  timestamp: number;
}

// ─── Save State ─────────────────────────────────────────────────────
export type SaveState = "saved" | "saving" | "unsaved" | "error";

// ─── Edit Buffer Entry ──────────────────────────────────────────────
export interface EditBufferEntry {
  buildingId: string;
  originalCoords: number[][][]; // AI-original geometry (never mutated)
  workingCoords: number[][][];  // current working copy
  reviewStatus: string;
  reviewComment: string;
  isDirty: boolean;
  properties: {
    name: string;
    shape_type: string;
    is_locked: boolean;
    is_visible: boolean;
    z_index: number;
    radius?: number;
    stroke?: string;
    fill?: string;
    opacity?: number;
    stroke_width?: number;
    [key: string]: any;
  };
}

const MAX_UNDO_STACK = 50;

export function useGISEditor(projectId: string) {
  // ─── Active Tool ────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<GISTool>("select");

  // ─── Selection ──────────────────────────────────────────────────
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());

  // ─── Edit Buffers ───────────────────────────────────────────────
  const [editBuffers, setEditBuffers] = useState<Record<string, EditBufferEntry>>({});

  // ─── Created Features List ─────────────────────────────────────
  const [createdFeatures, setCreatedFeatures] = useState<GeoJSONFeature[]>([]);

  // ─── Undo / Redo ────────────────────────────────────────────────
  const [undoStack, setUndoStack] = useState<EditCommand[]>([]);
  const [redoStack, setRedoStack] = useState<EditCommand[]>([]);

  // ─── Save State ─────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>("saved");

  // Automatically fallback to 'select' if selection is cleared while on selection-dependent tools
  useEffect(() => {
    if (!selectedFeatureId && ["scale", "rotate", "vertex_edit", "move"].includes(activeTool)) {
      setActiveTool("select");
    }
  }, [selectedFeatureId, activeTool]);

  // ─── Vertex Editing ─────────────────────────────────────────────
  const [activeVertexIndex, setActiveVertexIndex] = useState<number | null>(null);
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);

  // ─── Compare Mode ──────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false);

  // ─── Derived: has unsaved changes ──────────────────────────────
  const hasUnsavedChanges = useMemo(() => {
    return Object.values(editBuffers).some((buf) => buf.isDirty);
  }, [editBuffers]);

  // ─── Push Edit Command ─────────────────────────────────────────
  const pushCommand = useCallback(
    (cmd: EditCommand) => {
      setUndoStack((prev) => {
        const next = [...prev, cmd];
        if (next.length > MAX_UNDO_STACK) next.shift();
        return next;
      });
      setRedoStack([]); // clear redo on new action
      setSaveState("unsaved");
    },
    []
  );

  // ─── Start Editing a Feature ───────────────────────────────────
  const startEditing = useCallback(
    (feature: GeoJSONFeature) => {
      const bid = feature.properties.building_id;
      if (editBuffers[bid]) return; // already in buffer

      let coords = feature.geometry.coordinates;
      const shapeType = feature.properties.shape_type || (feature.geometry.type === "LineString" ? "line" : "polygon");

      if (feature.geometry.type === "LineString") {
        if (coords.length > 0 && !Array.isArray(coords[0][0])) {
          coords = [coords] as any;
        }
      } else if (feature.geometry.type === "Point") {
        if (!Array.isArray(coords[0])) {
          coords = [[[coords[0], coords[1]]]] as any;
        }
      }
      
      const defaultProps = {
        name: feature.properties.name || `Feature ${bid.substring(0, 5)}`,
        shape_type: shapeType,
        is_locked: feature.properties.is_locked || false,
        is_visible: feature.properties.is_visible !== false,
        z_index: feature.properties.z_index || 0,
        radius: feature.properties.radius || undefined,
        stroke: feature.properties.stroke || "#3b82f6",
        fill: feature.properties.fill || "#3b82f6",
        opacity: feature.properties.opacity ?? 0.4,
        stroke_width: feature.properties.stroke_width ?? 1.5,
      };

      setEditBuffers((prev) => ({
        ...prev,
        [bid]: {
          buildingId: bid,
          originalCoords: JSON.parse(JSON.stringify(coords)),
          workingCoords: JSON.parse(JSON.stringify(coords)),
          reviewStatus: feature.properties.review_status || "AI_DETECTED",
          reviewComment: feature.properties.review_comment || "",
          isDirty: false,
          properties: defaultProps,
        },
      }));
    },
    [editBuffers]
  );

  // ─── Create Feature ───────────────────────────────────────────
  const createFeature = useCallback(
    (shapeType: string, geometry: any, properties: any = {}) => {
      const newId = crypto.randomUUID();
      
      const defaultProps = {
        name: properties.name || `New ${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)}`,
        shape_type: shapeType,
        is_locked: false,
        is_visible: true,
        z_index: createdFeatures.length + 50,
        radius: properties.radius || undefined,
        stroke: properties.stroke || "#eab308",
        fill: properties.fill || "#eab308",
        opacity: properties.opacity ?? 0.4,
        stroke_width: properties.stroke_width ?? 1.5,
        review_status: "CREATED",
      };

      const newFeature: GeoJSONFeature = {
        type: "Feature",
        properties: {
          building_id: newId,
          area: properties.area || 0.0,
          confidence: 1.0,
          ...defaultProps,
        },
        geometry,
      };

      setCreatedFeatures((prev) => [...prev, newFeature]);

      // Initialize buffer entry
      setEditBuffers((prev) => ({
        ...prev,
        [newId]: {
          buildingId: newId,
          originalCoords: JSON.parse(JSON.stringify(geometry.coordinates)),
          workingCoords: JSON.parse(JSON.stringify(geometry.coordinates)),
          reviewStatus: "CREATED",
          reviewComment: "",
          isDirty: true,
          properties: defaultProps,
        },
      }));

      pushCommand({
        type: "CREATE_FEATURE",
        buildingId: newId,
        before: null,
        after: newFeature,
        timestamp: Date.now(),
      });

      setSelectedFeatureId(newId);
      setActiveTool("select");
      return newId;
    },
    [createdFeatures.length, pushCommand]
  );

  // ─── Delete Feature ───────────────────────────────────────────
  const deleteFeature = useCallback(
    (buildingId: string) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        const beforeStatus = entry ? entry.reviewStatus : "AI_DETECTED";

        pushCommand({
          type: "DELETE_FEATURE",
          buildingId,
          before: beforeStatus as any,
          after: "DELETED" as any,
          timestamp: Date.now(),
        });

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            buildingId,
            originalCoords: entry?.originalCoords || [[[]]],
            workingCoords: entry?.workingCoords || [[[]]],
            reviewStatus: "DELETED",
            reviewComment: entry?.reviewComment || "",
            isDirty: true,
            properties: entry?.properties || {
              name: "Deleted shape",
              shape_type: "polygon",
              is_locked: false,
              is_visible: false,
              z_index: 0,
            },
          },
        };
      });

      if (selectedFeatureId === buildingId) {
        setSelectedFeatureId(null);
      }
    },
    [pushCommand, selectedFeatureId]
  );

  // ─── Update Feature Properties ──────────────────────────────────
  const updateFeatureProperties = useCallback(
    (buildingId: string, newProperties: Partial<EditBufferEntry["properties"]>) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;

        const beforeProps = JSON.parse(JSON.stringify(entry.properties));
        const updatedProps = { ...entry.properties, ...newProperties };

        pushCommand({
          type: "UPDATE_PROPERTIES",
          buildingId,
          before: beforeProps,
          after: updatedProps,
          timestamp: Date.now(),
        });

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            properties: updatedProps,
            isDirty: true,
          },
        };
      });
    },
    [pushCommand]
  );

  // ─── Update Working Geometry ───────────────────────────────────
  const updateWorkingGeometry = useCallback(
    (buildingId: string, newCoords: number[][][], commandType: EditCommand["type"]) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;

        const beforeCoords = JSON.parse(JSON.stringify(entry.workingCoords));

        pushCommand({
          type: commandType,
          buildingId,
          before: beforeCoords,
          after: JSON.parse(JSON.stringify(newCoords)),
          timestamp: Date.now(),
        });

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            workingCoords: newCoords,
            isDirty: true,
          },
        };
      });
    },
    [pushCommand]
  );

  // ─── Move Single Vertex ────────────────────────────────────────
  const moveVertex = useCallback(
    (buildingId: string, ringIndex: number, vertexIndex: number, newLng: number, newLat: number) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;

        const newCoords = JSON.parse(JSON.stringify(entry.workingCoords));
        if (newCoords[ringIndex] && newCoords[ringIndex][vertexIndex]) {
          newCoords[ringIndex][vertexIndex] = [newLng, newLat];
          if (vertexIndex === 0) {
            newCoords[ringIndex][newCoords[ringIndex].length - 1] = [newLng, newLat];
          } else if (vertexIndex === newCoords[ringIndex].length - 1) {
            newCoords[ringIndex][0] = [newLng, newLat];
          }
        }

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            workingCoords: newCoords,
            isDirty: true,
          },
        };
      });
    },
    []
  );

  // ─── Commit Vertex Move (push to undo stack) ───────────────────
  const commitVertexMove = useCallback(
    (buildingId: string, beforeCoords: number[][][]) => {
      const entry = editBuffers[buildingId];
      if (!entry) return;

      pushCommand({
        type: "MOVE_VERTEX",
        buildingId,
        before: beforeCoords,
        after: JSON.parse(JSON.stringify(entry.workingCoords)),
        timestamp: Date.now(),
      });
    },
    [editBuffers, pushCommand]
  );

  // ─── Set Working Coordinates ──────────────────────────────────
  const setWorkingCoords = useCallback(
    (buildingId: string, newCoords: number[][][]) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;
        return {
          ...prev,
          [buildingId]: {
            ...entry,
            workingCoords: JSON.parse(JSON.stringify(newCoords)),
            isDirty: true,
          },
        };
      });
    },
    []
  );

  // ─── Commit Geometry Change ───────────────────────────────────
  const commitGeometryChange = useCallback(
    (buildingId: string, beforeCoords: number[][][], commandType: EditCommand["type"]) => {
      const entry = editBuffers[buildingId];
      if (!entry) return;

      pushCommand({
        type: commandType,
        buildingId,
        before: beforeCoords,
        after: JSON.parse(JSON.stringify(entry.workingCoords)),
        timestamp: Date.now(),
      });
    },
    [editBuffers, pushCommand]
  );

  // ─── Add Vertex ────────────────────────────────────────────────
  const addVertex = useCallback(
    (buildingId: string, ringIndex: number, afterIndex: number, lng: number, lat: number) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;

        const beforeCoords = JSON.parse(JSON.stringify(entry.workingCoords));
        const newCoords = JSON.parse(JSON.stringify(entry.workingCoords));
        newCoords[ringIndex].splice(afterIndex + 1, 0, [lng, lat]);

        pushCommand({
          type: "ADD_VERTEX",
          buildingId,
          before: beforeCoords,
          after: JSON.parse(JSON.stringify(newCoords)),
          timestamp: Date.now(),
        });

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            workingCoords: newCoords,
            isDirty: true,
          },
        };
      });
    },
    [pushCommand]
  );

  // ─── Delete Vertex ─────────────────────────────────────────────
  const deleteVertex = useCallback(
    (buildingId: string, ringIndex: number, vertexIndex: number) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;

        const ring = entry.workingCoords[ringIndex];
        if (ring.length <= 4) {
          console.warn("Cannot delete vertex: polygon needs at least 3 unique vertices.");
          return prev;
        }

        const beforeCoords = JSON.parse(JSON.stringify(entry.workingCoords));
        const newCoords = JSON.parse(JSON.stringify(entry.workingCoords));

        if (vertexIndex === 0 || vertexIndex === newCoords[ringIndex].length - 1) {
          newCoords[ringIndex].splice(0, 1);
          newCoords[ringIndex][newCoords[ringIndex].length - 1] = [...newCoords[ringIndex][0]];
        } else {
          newCoords[ringIndex].splice(vertexIndex, 1);
        }

        pushCommand({
          type: "DELETE_VERTEX",
          buildingId,
          before: beforeCoords,
          after: JSON.parse(JSON.stringify(newCoords)),
          timestamp: Date.now(),
        });

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            workingCoords: newCoords,
            isDirty: true,
          },
        };
      });
    },
    [pushCommand]
  );

  // ─── Nudge Geometry ────────────────────────────────────────────
  const nudgeGeometry = useCallback(
    (buildingId: string, direction: "N" | "S" | "E" | "W", fast = false) => {
      const OFFSET = fast ? 0.00002 : 0.000002;
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;

        const beforeCoords = JSON.parse(JSON.stringify(entry.workingCoords));
        const newCoords = entry.workingCoords.map((ring) =>
          ring.map((coord) => {
            let [lng, lat] = coord;
            if (direction === "N") lat += OFFSET;
            if (direction === "S") lat -= OFFSET;
            if (direction === "E") lng += OFFSET;
            if (direction === "W") lng -= OFFSET;
            return [lng, lat];
          })
        );

        pushCommand({
          type: "NUDGE_GEOMETRY",
          buildingId,
          before: beforeCoords,
          after: JSON.parse(JSON.stringify(newCoords)),
          timestamp: Date.now(),
        });

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            workingCoords: newCoords,
            isDirty: true,
          },
        };
      });
    },
    [pushCommand]
  );

  // ─── Scale Geometry ────────────────────────────────────────────
  const scaleGeometry = useCallback(
    (buildingId: string, factor: number) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;

        const beforeCoords = JSON.parse(JSON.stringify(entry.workingCoords));
        const ring = entry.workingCoords[0];

        let sumLng = 0, sumLat = 0;
        ring.forEach((c) => { sumLng += c[0]; sumLat += c[1]; });
        const cx = sumLng / ring.length;
        const cy = sumLat / ring.length;

        const newCoords = entry.workingCoords.map((r) =>
          r.map((c) => [cx + (c[0] - cx) * factor, cy + (c[1] - cy) * factor])
        );

        pushCommand({
          type: "SCALE_GEOMETRY",
          buildingId,
          before: beforeCoords,
          after: JSON.parse(JSON.stringify(newCoords)),
          timestamp: Date.now(),
        });

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            workingCoords: newCoords,
            isDirty: true,
          },
        };
      });
    },
    [pushCommand]
  );

  // ─── Reset to AI Geometry ──────────────────────────────────────
  const resetToAIGeometry = useCallback(
    (buildingId: string) => {
      setEditBuffers((prev) => {
        const entry = prev[buildingId];
        if (!entry) return prev;

        const beforeCoords = JSON.parse(JSON.stringify(entry.workingCoords));
        const originalCopy = JSON.parse(JSON.stringify(entry.originalCoords));

        pushCommand({
          type: "RESET_GEOMETRY",
          buildingId,
          before: beforeCoords,
          after: originalCopy,
          timestamp: Date.now(),
        });

        return {
          ...prev,
          [buildingId]: {
            ...entry,
            workingCoords: originalCopy,
            isDirty: true,
          },
        };
      });
    },
    [pushCommand]
  );

  // ─── Undo ──────────────────────────────────────────────────────
  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const cmd = prev[prev.length - 1];
      const remaining = prev.slice(0, -1);

      setRedoStack((redo) => [...redo, cmd]);

      if (cmd.type === "UPDATE_PROPERTIES") {
        setEditBuffers((bufs) => {
          const entry = bufs[cmd.buildingId];
          if (!entry) return bufs;
          return {
            ...bufs,
            [cmd.buildingId]: {
              ...entry,
              properties: JSON.parse(JSON.stringify(cmd.before)),
              isDirty: true,
            },
          };
        });
      } else if (cmd.type === "DELETE_FEATURE") {
        setEditBuffers((bufs) => {
          const entry = bufs[cmd.buildingId];
          if (!entry) return bufs;
          return {
            ...bufs,
            [cmd.buildingId]: {
              ...entry,
              reviewStatus: cmd.before as any,
              isDirty: true,
            },
          };
        });
      } else if (cmd.type === "CREATE_FEATURE") {
        setEditBuffers((bufs) => {
          const next = { ...bufs };
          delete next[cmd.buildingId];
          return next;
        });
        setCreatedFeatures((prevFeats) => prevFeats.filter((f) => f.properties.building_id !== cmd.buildingId));
        setSelectedFeatureId(null);
      } else if (cmd.before) {
        setEditBuffers((bufs) => {
          const entry = bufs[cmd.buildingId];
          if (!entry) return bufs;
          return {
            ...bufs,
            [cmd.buildingId]: {
              ...entry,
              workingCoords: JSON.parse(JSON.stringify(cmd.before)),
              isDirty: true,
            },
          };
        });
      }

      setSaveState("unsaved");
      return remaining;
    });
  }, []);

  // ─── Redo ──────────────────────────────────────────────────────
  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const cmd = prev[prev.length - 1];
      const remaining = prev.slice(0, -1);

      setUndoStack((undo) => [...undo, cmd]);

      if (cmd.type === "UPDATE_PROPERTIES") {
        setEditBuffers((bufs) => {
          const entry = bufs[cmd.buildingId];
          if (!entry) return bufs;
          return {
            ...bufs,
            [cmd.buildingId]: {
              ...entry,
              properties: JSON.parse(JSON.stringify(cmd.after)),
              isDirty: true,
            },
          };
        });
      } else if (cmd.type === "DELETE_FEATURE") {
        setEditBuffers((bufs) => {
          const entry = bufs[cmd.buildingId];
          if (!entry) return bufs;
          return {
            ...bufs,
            [cmd.buildingId]: {
              ...entry,
              reviewStatus: cmd.after as any,
              isDirty: true,
            },
          };
        });
      } else if (cmd.type === "CREATE_FEATURE") {
        const feat = cmd.after as GeoJSONFeature;
        setCreatedFeatures((prevFeats) => [...prevFeats, feat]);
        setEditBuffers((bufs) => ({
          ...bufs,
          [cmd.buildingId]: {
            buildingId: cmd.buildingId,
            originalCoords: JSON.parse(JSON.stringify(feat.geometry.coordinates)),
            workingCoords: JSON.parse(JSON.stringify(feat.geometry.coordinates)),
            reviewStatus: "CREATED",
            reviewComment: "",
            isDirty: true,
            properties: {
              name: feat.properties.name,
              shape_type: feat.properties.shape_type,
              is_locked: feat.properties.is_locked,
              is_visible: feat.properties.is_visible,
              z_index: feat.properties.z_index,
              radius: feat.properties.radius,
              stroke: feat.properties.stroke,
              fill: feat.properties.fill,
              opacity: feat.properties.opacity,
              stroke_width: feat.properties.stroke_width,
            },
          },
        }));
        setSelectedFeatureId(cmd.buildingId);
      } else if (cmd.after) {
        setEditBuffers((bufs) => {
          const entry = bufs[cmd.buildingId];
          if (!entry) return bufs;
          return {
            ...bufs,
            [cmd.buildingId]: {
              ...entry,
              workingCoords: JSON.parse(JSON.stringify(cmd.after)),
              isDirty: true,
            },
          };
        });
      }

      setSaveState("unsaved");
      return remaining;
    });
  }, []);

  // ─── Validate Geometry ─────────────────────────────────────────
  const validateGeometry = useCallback((coords: number[][][], shapeType = "polygon"): { valid: boolean; error?: string } => {
    if (!coords || coords.length === 0) return { valid: false, error: "Empty geometry." };

    if (shapeType === "line") {
      const lineRing = coords[0];
      if (lineRing.length < 2) return { valid: false, error: "Line needs at least 2 vertices." };
      return { valid: true };
    }

    const ring = coords[0];
    if (ring.length < 4) return { valid: false, error: "Polygon needs at least 3 unique vertices." };

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return { valid: false, error: "Ring is not closed (first != last coordinate)." };
    }

    for (const c of ring) {
      if (c[0] < -180 || c[0] > 180 || c[1] < -90 || c[1] > 90) {
        return { valid: false, error: "Coordinates out of valid range." };
      }
    }

    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    if (Math.abs(area) < 1e-15) {
      return { valid: false, error: "Polygon has zero area." };
    }

    return { valid: true };
  }, []);

  // ─── Save Single Feature ───────────────────────────────────────
  const saveFeature = useCallback(
    async (buildingId: string) => {
      const entry = editBuffers[buildingId];
      if (!entry || !entry.isDirty) return;

      const isDeleted = entry.reviewStatus === "DELETED";
      const isCreated = entry.reviewStatus === "CREATED";

      if (!isDeleted) {
        const validation = validateGeometry(entry.workingCoords, entry.properties.shape_type);
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid geometry.");
        }
      }

      setSaveState("saving");
      try {
        if (isDeleted) {
          await deleteBuilding(projectId, buildingId);
          setEditBuffers((prev) => {
            const next = { ...prev };
            delete next[buildingId];
            return next;
          });
          setCreatedFeatures((prev) => prev.filter((f) => f.properties.building_id !== buildingId));
        } else {
          // Serialize properties to comment JSON string
          const commentMetadata = {
            ...entry.properties,
            comment: entry.reviewComment,
          };
          const serializedComment = JSON.stringify(commentMetadata);

          if (isCreated) {
            let geomType = "Polygon";
            let finalCoords = entry.workingCoords;
            if (entry.properties.shape_type === "line") {
              geomType = "LineString";
              if (Array.isArray(finalCoords) && Array.isArray(finalCoords[0]) && Array.isArray(finalCoords[0][0])) {
                finalCoords = finalCoords[0] as any;
              }
            }
            await createBuilding(projectId, {
              geometry: { type: geomType, coordinates: finalCoords },
              area: entry.properties.area || 0.0,
              confidence: 1.0,
              review_status: "CREATED",
              reviewed_by: "Surveyor",
              review_comment: serializedComment,
            });
          } else {
            let geomType = "Polygon";
            let finalCoords = entry.workingCoords;
            if (entry.properties.shape_type === "line") {
              geomType = "LineString";
              if (Array.isArray(finalCoords) && Array.isArray(finalCoords[0]) && Array.isArray(finalCoords[0][0])) {
                finalCoords = finalCoords[0] as any;
              }
            }
            const geomChanged =
              JSON.stringify(entry.workingCoords) !== JSON.stringify(entry.originalCoords);
            await patchBuildingReview(projectId, buildingId, {
              review_status: "EDITED",
              modified_geometry: geomChanged
                ? { type: geomType, coordinates: finalCoords }
                : undefined,
              reviewed_by: "Surveyor",
              review_comment: serializedComment,
            });
          }

          setEditBuffers((prev) => ({
            ...prev,
            [buildingId]: { ...prev[buildingId], isDirty: false },
          }));
        }
        setSaveState("saved");
      } catch (err) {
        console.error("Save failed:", err);
        setSaveState("error");
        throw err;
      }
    },
    [editBuffers, projectId, validateGeometry]
  );

  // ─── Save All Dirty Features ───────────────────────────────────
  const saveAll = useCallback(async () => {
    const dirtyIds = Object.keys(editBuffers).filter((id) => editBuffers[id].isDirty);
    if (dirtyIds.length === 0) return;

    setSaveState("saving");
    try {
      for (const id of dirtyIds) {
        await saveFeature(id);
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [editBuffers, saveFeature]);

  // ─── Approve Feature ───────────────────────────────────────────
  const approveFeature = useCallback(
    async (buildingId: string) => {
      const entry = editBuffers[buildingId];
      const geomChanged = entry
        ? JSON.stringify(entry.workingCoords) !== JSON.stringify(entry.originalCoords)
        : false;

      setSaveState("saving");
      try {
        const commentMetadata = entry ? {
          ...entry.properties,
          comment: entry.reviewComment,
        } : { comment: "" };

        let geomType = "Polygon";
        let finalCoords = entry ? entry.workingCoords : null;
        if (entry && entry.properties.shape_type === "line") {
          geomType = "LineString";
          if (finalCoords && Array.isArray(finalCoords) && Array.isArray(finalCoords[0]) && Array.isArray(finalCoords[0][0])) {
            finalCoords = finalCoords[0] as any;
          }
        }

        await patchBuildingReview(projectId, buildingId, {
          review_status: geomChanged ? "EDITED" : "APPROVED",
          modified_geometry: geomChanged && entry && finalCoords
            ? { type: geomType, coordinates: finalCoords }
            : undefined,
          reviewed_by: "Surveyor",
          review_comment: JSON.stringify(commentMetadata),
        });

        if (entry) {
          setEditBuffers((prev) => ({
            ...prev,
            [buildingId]: {
              ...prev[buildingId],
              isDirty: false,
              reviewStatus: geomChanged ? "EDITED" : "APPROVED",
            },
          }));
        }
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [editBuffers, projectId]
  );

  // ─── Reject Feature ────────────────────────────────────────────
  const rejectFeature = useCallback(
    async (buildingId: string, comment?: string) => {
      setSaveState("saving");
      try {
        await patchBuildingReview(projectId, buildingId, {
          review_status: "REJECTED",
          reviewed_by: "Surveyor",
          review_comment: comment || "Rejected during review.",
        });

        setEditBuffers((prev) => {
          const newBufs = { ...prev };
          delete newBufs[buildingId];
          return newBufs;
        });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [projectId]
  );

  // ─── Update Review Comment ─────────────────────────────────────
  const updateReviewComment = useCallback((buildingId: string, comment: string) => {
    setEditBuffers((prev) => {
      const entry = prev[buildingId];
      if (!entry) return prev;
      return {
        ...prev,
        [buildingId]: { ...entry, reviewComment: comment, isDirty: true },
      };
    });
  }, []);

  // ─── Select Feature ────────────────────────────────────────────
  const selectFeature = useCallback(
    (featureId: string | null, multiSelect = false) => {
      if (multiSelect && featureId) {
        setMultiSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(featureId)) {
            next.delete(featureId);
          } else {
            next.add(featureId);
          }
          return next;
        });
      } else {
        setSelectedFeatureId(featureId);
        setMultiSelectedIds(new Set());
        setActiveVertexIndex(null);
      }
    },
    []
  );

  // ─── Get Working Geometry for a Feature ────────────────────────
  const getWorkingCoords = useCallback(
    (buildingId: string): number[][][] | null => {
      return editBuffers[buildingId]?.workingCoords || null;
    },
    [editBuffers]
  );

  return {
    // Tool
    activeTool,
    setActiveTool,
    // Selection
    selectedFeatureId,
    multiSelectedIds,
    selectFeature,
    // Edit buffers
    editBuffers,
    startEditing,
    updateWorkingGeometry,
    getWorkingCoords,
    // Created Features list
    createdFeatures,
    createFeature,
    deleteFeature,
    updateFeatureProperties,
    // Vertex editing
    activeVertexIndex,
    setActiveVertexIndex,
    isDraggingVertex,
    setIsDraggingVertex,
    moveVertex,
    commitVertexMove,
    setWorkingCoords,
    commitGeometryChange,
    addVertex,
    deleteVertex,
    // Geometry operations
    nudgeGeometry,
    scaleGeometry,
    resetToAIGeometry,
    // Undo / Redo
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoStack,
    // Save
    saveState,
    setSaveState,
    hasUnsavedChanges,
    saveFeature,
    saveAll,
    validateGeometry,
    // Review
    approveFeature,
    rejectFeature,
    updateReviewComment,
    // Compare
    compareMode,
    setCompareMode,
  };
}
