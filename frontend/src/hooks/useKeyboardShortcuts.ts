"use client";

import { useEffect } from "react";
import { GISTool } from "./useGISEditor";

interface ShortcutHandlers {
  activeTool: GISTool;
  setActiveTool: (tool: GISTool) => void;
  selectedFeatureId: string | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveActive: () => void;
  approveActive: () => void;
  rejectActive: () => void;
  cancelActive: () => void;
  deleteVertexActive: () => void;
  deleteFeatureActive?: () => void;
  nudgeGeometry?: (id: string, direction: "N" | "S" | "E" | "W", fast: boolean) => void;
}

export function useKeyboardShortcuts({
  activeTool,
  setActiveTool,
  selectedFeatureId,
  undo,
  redo,
  canUndo,
  canRedo,
  saveActive,
  approveActive,
  rejectActive,
  cancelActive,
  deleteVertexActive,
  deleteFeatureActive = () => {},
  nudgeGeometry = () => {},
}: ShortcutHandlers) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Command combination shortcuts
      if (cmdOrCtrl) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            if (canRedo) redo();
          } else {
            if (canUndo) undo();
          }
          return;
        }

        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          saveActive();
          return;
        }
      }

      // 2. Arrow keys nudging
      if (selectedFeatureId) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          nudgeGeometry(selectedFeatureId, "N", e.shiftKey);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          nudgeGeometry(selectedFeatureId, "S", e.shiftKey);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudgeGeometry(selectedFeatureId, "W", e.shiftKey);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          nudgeGeometry(selectedFeatureId, "E", e.shiftKey);
          return;
        }
      }

      // 3. Normal single-key shortcuts
      switch (e.key.toLowerCase()) {
        case "v": // Select tool
          e.preventDefault();
          setActiveTool("select");
          break;
        case "h": // Pan tool
          e.preventDefault();
          setActiveTool("pan");
          break;
        case "e": // Vertex edit tool
          e.preventDefault();
          if (selectedFeatureId) {
            setActiveTool("vertex_edit");
          }
          break;
        case "m": // Move geometry
          e.preventDefault();
          if (selectedFeatureId) {
            setActiveTool("move");
          }
          break;
        case "r": // Rotate geometry
          e.preventDefault();
          if (selectedFeatureId) {
            setActiveTool("rotate");
          }
          break;
        case "s": // Scale tool (without cmd/ctrl)
          if (!cmdOrCtrl && selectedFeatureId) {
            e.preventDefault();
            setActiveTool("scale");
          }
          break;
        case "a": // Approve
          e.preventDefault();
          if (selectedFeatureId) {
            approveActive();
          }
          break;
        case "x": // Reject
          e.preventDefault();
          if (selectedFeatureId) {
            rejectActive();
          }
          break;
        case "escape": // Cancel / Deselect
          e.preventDefault();
          cancelActive();
          break;
        case "delete":
        case "backspace": // Delete selected vertex / feature
          if (selectedFeatureId) {
            e.preventDefault();
            if (activeTool === "vertex_edit") {
              deleteVertexActive();
            } else {
              deleteFeatureActive();
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeTool,
    setActiveTool,
    selectedFeatureId,
    undo,
    redo,
    canUndo,
    canRedo,
    saveActive,
    approveActive,
    rejectActive,
    cancelActive,
    deleteVertexActive,
    deleteFeatureActive,
    nudgeGeometry,
  ]);
}
