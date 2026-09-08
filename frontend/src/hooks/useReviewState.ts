import { useState, useEffect, useCallback, useMemo } from "react";
import { patchBuildingReview, patchBuildingReviewPayload } from "@/lib/api/buildings";
import { GeoJSONFeature } from "@/types";

export interface BuildingReviewOverride {
  building_id: string;
  review_status: "approved" | "rejected" | "edited";
  edited_geometry?: any;
  updated_at: string;
}

export type ReviewStateMap = Record<string, BuildingReviewOverride>;

export function useReviewState(projectId: string) {
  const storageKey = useMemo(() => `anavya_review_state_${projectId}`, [projectId]);
  const [reviewState, setReviewState] = useState<ReviewStateMap>({});

  // 1. Load session overrides and trigger LocalStorage migration on mount
  useEffect(() => {
    if (typeof window === "undefined" || !projectId) return;

    const migrateLocalStorage = async () => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed: ReviewStateMap = JSON.parse(stored);
          console.log(`Migration: Found ${Object.keys(parsed).length} reviews in LocalStorage. Syncing to backend...`);
          
          // Sync each item to backend sequentially
          for (const bId of Object.keys(parsed)) {
            const item = parsed[bId];
            const payload: patchBuildingReviewPayload = {
              review_status: item.review_status.toUpperCase(),
              modified_geometry: item.edited_geometry,
              reviewed_by: "Surveyor (Migrated)"
            };
            try {
              await patchBuildingReview(projectId, bId, payload);
            } catch (err) {
              console.error(`Migration failed for building ${bId}:`, err);
            }
          }
          
          // Clear LocalStorage once synced
          localStorage.removeItem(storageKey);
          console.log("Migration completed. LocalStorage cleared.");
        }
      } catch (e) {
        console.error("LocalStorage migration failed:", e);
      }
    };

    migrateLocalStorage();
  }, [storageKey, projectId]);

  // 2. Action handlers syncing to backend
  const approveBuilding = useCallback(
    async (buildingId: string) => {
      const updatedItem: BuildingReviewOverride = {
        building_id: buildingId,
        review_status: "approved",
        updated_at: new Date().toISOString(),
      };

      // Snappy UI update
      setReviewState((prev) => ({
        ...prev,
        [buildingId]: updatedItem
      }));

      // Async backend sync
      try {
        await patchBuildingReview(projectId, buildingId, {
          review_status: "APPROVED",
          reviewed_by: "Surveyor"
        });
      } catch (err) {
        console.error(`Failed to sync building approval ${buildingId} to backend:`, err);
      }
    },
    [projectId]
  );

  const rejectBuilding = useCallback(
    async (buildingId: string) => {
      const updatedItem: BuildingReviewOverride = {
        building_id: buildingId,
        review_status: "rejected",
        updated_at: new Date().toISOString(),
      };

      // Snappy UI update
      setReviewState((prev) => ({
        ...prev,
        [buildingId]: updatedItem
      }));

      // Async backend sync
      try {
        await patchBuildingReview(projectId, buildingId, {
          review_status: "REJECTED",
          reviewed_by: "Surveyor",
          review_comment: "False building detection"
        });
      } catch (err) {
        console.error(`Failed to sync building rejection ${buildingId} to backend:`, err);
      }
    },
    [projectId]
  );

  const editBuildingGeometry = useCallback(
    async (buildingId: string, newCoords: any) => {
      const updatedItem: BuildingReviewOverride = {
        building_id: buildingId,
        review_status: "edited",
        edited_geometry: {
          type: "Polygon",
          coordinates: newCoords,
        },
        updated_at: new Date().toISOString(),
      };

      // Snappy UI update
      setReviewState((prev) => ({
        ...prev,
        [buildingId]: updatedItem
      }));

      // Async backend sync
      try {
        await patchBuildingReview(projectId, buildingId, {
          review_status: "EDITED",
          modified_geometry: {
            type: "Polygon",
            coordinates: newCoords
          },
          reviewed_by: "Surveyor"
        });
      } catch (err) {
        console.error(`Failed to sync building geometry edits ${buildingId} to backend:`, err);
      }
    },
    [projectId]
  );

  const resetReviewState = useCallback(() => {
    setReviewState({});
    // Local storage is cleared during migration, so we just reset our local overrides map.
    // Resetting backend QA states can be done if desired by sending a RESET action or delete overrides.
    // For presentation purposes, resetting React state clears current overrides.
  }, []);

  // Compute review statistics dynamically based on feature confidence values & existing reviews
  const getReviewStats = useCallback(
    (features: GeoJSONFeature[], confidenceThreshold = 0.7) => {
      let approvedCount = 0;
      let rejectedCount = 0;
      let editedCount = 0;
      let needsReviewCount = 0;
      let highConfidenceAutoApproved = 0;

      features.forEach((feature) => {
        const buildingId = feature.properties.building_id;
        const confidence = feature.properties.confidence || 0;
        
        // Use properties review_status directly since backend merges them,
        // fallback to current session overrides if not yet refetched
        const dbStatus = feature.properties.review_status;
        const override = reviewState[buildingId];
        const activeStatus = override ? override.review_status : dbStatus;

        if (activeStatus === "approved" || activeStatus === "APPROVED") {
          approvedCount++;
        } else if (activeStatus === "rejected" || activeStatus === "REJECTED") {
          rejectedCount++;
        } else if (activeStatus === "edited" || activeStatus === "EDITED") {
          editedCount++;
        } else {
          // Feature hasn't been reviewed yet
          if (confidence < confidenceThreshold) {
            needsReviewCount++;
          } else {
            highConfidenceAutoApproved++;
          }
        }
      });

      return {
        total: features.length,
        approved: approvedCount,
        rejected: rejectedCount,
        edited: editedCount,
        needsReview: needsReviewCount,
        autoApproved: highConfidenceAutoApproved,
        reviewedCount: approvedCount + rejectedCount + editedCount,
      };
    },
    [reviewState]
  );

  return {
    reviewState,
    approveBuilding,
    rejectBuilding,
    editBuildingGeometry,
    resetReviewState,
    getReviewStats,
  };
}
