import { useState, useEffect, useCallback, useMemo } from "react";
import { GeoJSONFeatureCollection } from "@/types";
import { getBuildings } from "@/lib/api/buildings";

export function useBuildings(projectId: string) {
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuildings = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBuildings(projectId);
      setGeojson(data);
    } catch (err: any) {
      console.error("Error in useBuildings hook:", err);
      setError(err.message || "Failed to fetch building footprints.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  // Merge default properties if needed, otherwise backend properties are authoritative
  const processedGeojson = useMemo((): GeoJSONFeatureCollection | null => {
    if (!geojson) return null;

    const processedFeatures = geojson.features.map((feature) => {
      const properties = feature.properties || {};
      const confidence = properties.confidence || 0;
      
      // Default to needs_review or approved classification if review_status is missing
      const reviewStatus = properties.review_status || (confidence < 0.7 ? "needs_review" : "approved");

      return {
        ...feature,
        properties: {
          ...properties,
          review_status: reviewStatus,
        },
      };
    });

    return {
      ...geojson,
      features: processedFeatures,
    };
  }, [geojson]);

  return {
    geojson: processedGeojson,
    loading,
    error,
    refetch: fetchBuildings,
  };
}
