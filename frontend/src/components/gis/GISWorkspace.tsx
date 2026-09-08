"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Project, GeoJSONFeatureCollection, GeoJSONFeature } from "@/types";
import { useBuildings } from "@/hooks/useBuildings";
import { useGISEditor } from "@/hooks/useGISEditor";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import GISToolbar from "./GISToolbar";
import GISToolPalette from "./GISToolPalette";
import GISMapCanvas from "./GISMapCanvas";
import GISLayerPanel from "./GISLayerPanel";
import GISFeatureInspector from "./GISFeatureInspector";
import GISReviewQueue from "./GISReviewQueue";
import GISStatusBar from "./GISStatusBar";
import { Map as MaplibreMap } from "maplibre-gl";

interface GISWorkspaceProps {
  project: Project;
}

export default function GISWorkspace({ project }: GISWorkspaceProps) {
  // 1. Fetch buildings GeoJSON
  const { geojson, loading, error, refetch } = useBuildings(project.id);

  // 2. Initialize GIS editor state machine hook
  const editor = useGISEditor(project.id);

  // 3. Keep track of map zoom and cursor coordinates for status bar
  const [zoom, setZoom] = useState(18);
  const [cursorCoords, setCursorCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [mapInstance, setMapInstance] = useState<MaplibreMap | null>(null);

  // 4. Layer panel visibility states
  const [showOrtho, setShowOrtho] = useState(true);
  const [orthoOpacity, setOrthoOpacity] = useState(0.85);
  const [showBuildings, setShowBuildings] = useState(true);
  const [buildingsOpacity, setBuildingsOpacity] = useState(1.0);
  const [visMode, setVisMode] = useState<"normal" | "confidence" | "review">("normal");

  // TIFF image controls state
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(false);

  // Confidence threshold
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);

  // Scribble automation class selection
  const [scribbleClass, setScribbleClass] = useState<"tree" | "road">("tree");

  // Bind fresh callbacks to window so MapCanvas map events can access them
  useEffect(() => {
    (window as any).nextGISEditorInstance = {
      createFeature: (type: string, geometry: any, properties: any) => {
        editor.createFeature(type, geometry, properties);
      },
      updateFeatureProperties: (id: string, props: any) => {
        editor.updateFeatureProperties(id, props);
      },
      deleteVertex: (id: string, ringIdx: number, vertexIdx: number) => {
        editor.deleteVertex(id, ringIdx, vertexIdx);
      }
    };
    return () => {
      (window as any).nextGISEditorInstance = null;
    };
  }, [editor]);

  // Find active selected feature object
  const activeFeature = useMemo((): GeoJSONFeature | null => {
    if (!editor.selectedFeatureId) return null;
    // Check in initial geojson first
    let feat = geojson?.features.find((f) => f.properties.building_id === editor.selectedFeatureId) || null;
    if (!feat) {
      // Check in created features
      feat = editor.createdFeatures.find((f) => f.properties.building_id === editor.selectedFeatureId) || null;
    }
    return feat;
  }, [editor.selectedFeatureId, geojson, editor.createdFeatures]);

  // Merge workspace live edits into geojson object passed to canvas
  const mergedGeoJSON = useMemo((): GeoJSONFeatureCollection | null => {
    if (!geojson) return null;

    // Filter out deleted features
    const activeFeatures = geojson.features.filter((f) => {
      const bid = f.properties.building_id;
      const buf = editor.editBuffers[bid];
      return !buf || buf.reviewStatus !== "DELETED";
    });

    const features = activeFeatures.map((f) => {
      const bid = f.properties.building_id;
      const buf = editor.editBuffers[bid];
      if (buf) {
        return {
          ...f,
          geometry: {
            ...f.geometry,
            coordinates: buf.workingCoords,
          },
          properties: {
            ...f.properties,
            ...buf.properties,
            review_status: buf.reviewStatus,
            review_comment: buf.reviewComment,
          },
        };
      }
      return f;
    });

    // Append newly created features
    editor.createdFeatures.forEach((f) => {
      const bid = f.properties.building_id;
      const buf = editor.editBuffers[bid];
      if (buf && buf.reviewStatus !== "DELETED") {
        features.push({
          ...f,
          geometry: {
            ...f.geometry,
            coordinates: buf.workingCoords,
          },
          properties: {
            ...f.properties,
            ...buf.properties,
            review_status: buf.reviewStatus,
            review_comment: buf.reviewComment,
          },
        });
      }
    });

    // Sort features by properties.z_index
    features.sort((a, b) => (a.properties.z_index || 0) - (b.properties.z_index || 0));

    return {
      ...geojson,
      features,
    };
  }, [geojson, editor.editBuffers, editor.createdFeatures]);

  // Load and start editing buffering when selection changes
  const handleSelectFeature = useCallback(
    (featureId: string | null) => {
      editor.selectFeature(featureId);
      if (featureId) {
        let feature = geojson?.features.find((f) => f.properties.building_id === featureId);
        if (!feature) {
          feature = editor.createdFeatures.find((f) => f.properties.building_id === featureId);
        }
        if (feature) {
          editor.startEditing(feature);
        }
      }
    },
    [editor, geojson, editor.createdFeatures]
  );

  // Compile active queue items for auto-advance lookup
  const queueItems = useMemo(() => {
    if (!geojson) return [];
    return geojson.features
      .filter((f) => {
        const bid = f.properties.building_id;
        const buf = editor.editBuffers[bid];
        const status = buf ? buf.reviewStatus : (f.properties.review_status || "needs_review");
        const isReviewed = ["APPROVED", "approved", "EDITED", "edited", "REJECTED", "rejected", "DELETED", "deleted"].includes(status);
        const conf = f.properties.confidence || 0;
        return conf < confidenceThreshold && !isReviewed;
      })
      .sort((a, b) => (a.properties.confidence || 0) - (b.properties.confidence || 0));
  }, [geojson, editor.editBuffers, confidenceThreshold]);

  // Auto-advance helper to select the next item in the queue
  const selectNextQueueItem = useCallback(() => {
    if (queueItems.length > 0) {
      const idx = queueItems.findIndex((item) => item.properties.building_id === editor.selectedFeatureId);
      let nextIdx = 0;
      if (idx !== -1 && idx < queueItems.length - 1) {
        nextIdx = idx + 1;
      }
      const nextId = queueItems[nextIdx].properties.building_id;
      handleSelectFeature(nextId);
    } else {
      editor.selectFeature(null);
    }
  }, [queueItems, editor.selectedFeatureId, handleSelectFeature, editor]);

  // Wrap Approve & Reject with auto-advance logic
  const handleApprove = useCallback(
    async (id: string) => {
      await editor.approveFeature(id);
      selectNextQueueItem();
      refetch(); // sync backend
    },
    [editor, selectNextQueueItem, refetch]
  );

  const handleReject = useCallback(
    async (id: string, comment?: string) => {
      await editor.rejectFeature(id, comment);
      selectNextQueueItem();
      refetch();
    },
    [editor, selectNextQueueItem, refetch]
  );

  // Save changes
  const handleSaveActive = useCallback(async () => {
    if (editor.selectedFeatureId) {
      await editor.saveFeature(editor.selectedFeatureId);
      refetch();
    }
  }, [editor, refetch]);

  // Fit Views
  const handleFitSurvey = () => {
    if (!mapInstance || !project.bounds) return;
    mapInstance.fitBounds(project.bounds as [number, number, number, number], {
      padding: 50,
      maxZoom: 19,
      animate: true,
      duration: 1000,
    });
  };

  const handleFitSelection = () => {
    if (!mapInstance || !activeFeature) return;
    const coords = editor.getWorkingCoords(activeFeature.properties.building_id) || 
      (activeFeature.geometry.coordinates as number[][][]);
    if (coords && coords[0]) {
      let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
      coords[0].forEach((c) => {
        if (c[0] < minLng) minLng = c[0];
        if (c[0] > maxLng) maxLng = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[1] > maxLat) maxLat = c[1];
      });
      mapInstance.fitBounds([minLng, minLat, maxLng, maxLat], {
        padding: 100,
        maxZoom: 20,
        animate: true,
        duration: 1000,
      });
    }
  };

  // Keyboard Shortcuts hook wire up
  useKeyboardShortcuts({
    activeTool: editor.activeTool,
    setActiveTool: editor.setActiveTool,
    selectedFeatureId: editor.selectedFeatureId,
    undo: editor.undo,
    redo: editor.redo,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    saveActive: handleSaveActive,
    approveActive: () => editor.selectedFeatureId && handleApprove(editor.selectedFeatureId),
    rejectActive: () => editor.selectedFeatureId && handleReject(editor.selectedFeatureId),
    cancelActive: () => handleSelectFeature(null),
    deleteVertexActive: () => {
      if (editor.selectedFeatureId && editor.activeVertexIndex !== null) {
        editor.deleteVertex(editor.selectedFeatureId, 0, editor.activeVertexIndex);
        editor.setActiveVertexIndex(null);
      }
    },
    deleteFeatureActive: () => {
      if (editor.selectedFeatureId) {
        editor.deleteFeature(editor.selectedFeatureId);
      }
    },
    nudgeGeometry: editor.nudgeGeometry,
  });

  const activeBufferEntry = editor.selectedFeatureId ? editor.editBuffers[editor.selectedFeatureId] : undefined;

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col z-50 text-zinc-300 font-sans overflow-hidden">
      {/* 1. Toolbar */}
      <GISToolbar
        projectName={project.name}
        projectId={project.id}
        saveState={editor.saveState}
        onSave={handleSaveActive}
        onSaveAll={editor.saveAll}
        onUndo={editor.undo}
        onRedo={editor.redo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onReset={() => editor.selectedFeatureId && editor.resetToAIGeometry(editor.selectedFeatureId)}
        compareMode={editor.compareMode}
        setCompareMode={editor.setCompareMode}
        onFitSurvey={handleFitSurvey}
        onFitSelection={handleFitSelection}
        hasUnsaved={editor.hasUnsavedChanges}
      />

      {/* 2. Main content row */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Tool Palette */}
        <GISToolPalette
          activeTool={editor.activeTool}
          setActiveTool={editor.setActiveTool}
          selectedId={editor.selectedFeatureId}
          onApprove={() => editor.selectedFeatureId && handleApprove(editor.selectedFeatureId)}
          onReject={() => editor.selectedFeatureId && handleReject(editor.selectedFeatureId)}
          scribbleClass={scribbleClass}
          setScribbleClass={setScribbleClass}
        />

        {/* Queue panel */}
        <GISReviewQueue
          features={geojson?.features || []}
          selectedId={editor.selectedFeatureId}
          onSelect={handleSelectFeature}
          confidenceThreshold={confidenceThreshold}
          setConfidenceThreshold={setConfidenceThreshold}
        />

        {/* Map canvas container */}
        <div 
          className="flex-1 h-full relative"
          style={{
            filter: `brightness(${brightness}%) contrast(${contrast}%) ${grayscale ? "grayscale(100%)" : ""}`
          }}
        >
          <GISMapCanvas
            project={project}
            geojson={mergedGeoJSON}
            loading={loading}
            activeTool={editor.activeTool}
            setActiveTool={editor.setActiveTool}
            selectedId={editor.selectedFeatureId}
            selectFeature={handleSelectFeature}
            workingCoords={editor.selectedFeatureId ? editor.getWorkingCoords(editor.selectedFeatureId) : null}
            moveVertex={editor.moveVertex}
            commitVertexMove={editor.commitVertexMove}
            setWorkingCoords={editor.setWorkingCoords}
            commitGeometryChange={editor.commitGeometryChange}
            isDraggingVertex={editor.isDraggingVertex}
            setIsDraggingVertex={editor.setIsDraggingVertex}
            addVertex={editor.addVertex}
            deleteVertex={editor.deleteVertex}
            compareMode={editor.compareMode}
            showOrtho={showOrtho}
            orthoOpacity={orthoOpacity}
            showBuildings={showBuildings}
            buildingsOpacity={buildingsOpacity}
            visMode={visMode}
            onCursorMove={(lng, lat) => setCursorCoords({ lng, lat })}
            onZoomChange={setZoom}
            onMapInit={setMapInstance}
            scribbleClass={scribbleClass}
          />
        </div>

        {/* Layer panel */}
        <GISLayerPanel
          showOrtho={showOrtho}
          setShowOrtho={setShowOrtho}
          orthoOpacity={orthoOpacity}
          setOrthoOpacity={setOrthoOpacity}
          showBuildings={showBuildings}
          setShowBuildings={setShowBuildings}
          buildingsOpacity={buildingsOpacity}
          setBuildingsOpacity={setBuildingsOpacity}
          visMode={visMode}
          setVisMode={setVisMode}
          brightness={brightness}
          setBrightness={setBrightness}
          contrast={contrast}
          setContrast={setContrast}
          grayscale={grayscale}
          setGrayscale={setGrayscale}
          features={mergedGeoJSON?.features || []}
          selectedId={editor.selectedFeatureId}
          selectFeature={handleSelectFeature}
          updateFeatureProperties={editor.updateFeatureProperties}
          deleteFeature={editor.deleteFeature}
          mapInstance={mapInstance}
        />

        {/* Feature Inspector */}
        {activeFeature && (
          <GISFeatureInspector
            feature={activeFeature}
            bufferEntry={activeBufferEntry}
            onApprove={handleApprove}
            onReject={handleReject}
            onReset={editor.resetToAIGeometry}
            onCommentChange={editor.updateReviewComment}
            onClose={() => handleSelectFeature(null)}
            isEditing={editor.activeTool === "vertex_edit"}
            setIsEditing={(val) => editor.setActiveTool(val ? "vertex_edit" : "select")}
            updateFeatureProperties={editor.updateFeatureProperties}
            setWorkingCoords={editor.setWorkingCoords}
          />
        )}
      </div>

      {/* 3. Status Bar */}
      <GISStatusBar
        cursorCoords={cursorCoords}
        zoom={zoom}
        selectedId={editor.selectedFeatureId}
        totalFeatures={geojson?.features.length || 0}
        saveState={editor.saveState}
        activeTool={editor.activeTool}
      />
    </div>
  );
}
