import { useState, useEffect, useRef, useCallback } from "react";
import { getProcessingStatus } from "@/lib/api/processing";
import { ProcessingStatus } from "@/types";

const ACTIVE_STATES = ["PREPROCESSING", "TILING", "AI_INFERENCE", "VECTORIZATION"];

export function useProcessingStatus(projectId: string, initialStatus?: string) {
  const [status, setStatus] = useState<string>(initialStatus || "LOADING");
  const [progress, setProgress] = useState<number>(0);
  const [tilesProcessed, setTilesProcessed] = useState<number>(0);
  const [totalTiles, setTotalTiles] = useState<number>(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [connectionInterrupted, setConnectionInterrupted] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const data: ProcessingStatus = await getProcessingStatus(projectId);
      setStatus(data.status);
      setProgress(data.progress);
      setTilesProcessed(data.tiles_processed);
      setTotalTiles(data.total_tiles);
      setMessage(data.message);
      setLogs(data.logs || []);
      
      // Reset network error tracking
      errorCountRef.current = 0;
      setConnectionInterrupted(false);
      setError(null);
      
      // Stop polling if we reach terminal states
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        stopPolling();
      }
    } catch (err: any) {
      console.error("Error fetching processing status:", err);
      errorCountRef.current += 1;
      
      // If we fail up to 3 times consecutively, show connection error
      if (errorCountRef.current >= 3) {
        setConnectionInterrupted(true);
        setError("Connection to backend interrupted. Retrying...");
      } else {
        // Keep polling on temporary glitch
        console.warn(`Temporary polling failure (${errorCountRef.current}/3)`);
      }
      
      // If server returns critical error (404/500/etc.) repeatedly, we handle it but don't crash
      if (errorCountRef.current >= 8) {
        setError(err.message || "Failed to retrieve processing status after multiple retries.");
        stopPolling();
      }
    }
  }, [projectId, stopPolling]);

  const startPolling = useCallback(() => {
    if (timerRef.current) return;
    setIsPolling(true);
    setError(null);
    setConnectionInterrupted(false);
    errorCountRef.current = 0;
    
    // Fetch immediately
    fetchStatus();
    
    // Start interval
    timerRef.current = setInterval(fetchStatus, 2500);
  }, [fetchStatus]);

  // Effect to manage initial load and polling lifecycle
  useEffect(() => {
    if (!projectId) return;

    const initAndPoll = async () => {
      try {
        // Get the latest status from backend upon initialization (source of truth)
        const data = await getProcessingStatus(projectId);
        setStatus(data.status);
        setProgress(data.progress);
        setTilesProcessed(data.tiles_processed);
        setTotalTiles(data.total_tiles);
        setMessage(data.message);
        setLogs(data.logs || []);

        if (ACTIVE_STATES.includes(data.status)) {
          startPolling();
        } else {
          // If not processing (e.g. COMPLETED or UPLOADED), do not poll
          stopPolling();
        }
      } catch (err: any) {
        console.error("Failed to load initial status:", err);
        setError("Failed to connect to backend server.");
        // Try starting polling anyway to see if backend comes online
        startPolling();
      }
    };

    initAndPoll();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [projectId]); // Depend on projectId so we reset state correctly when navigating projects

  // Effect for Tab / Window Focus Visibility Change Refetch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Tab became visible, refetching project status...");
        fetchStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchStatus]);

  return {
    status,
    progress,
    tilesProcessed,
    totalTiles,
    message,
    error,
    isPolling,
    logs,
    connectionInterrupted,
    startPolling,
    stopPolling,
    refreshStatus: fetchStatus,
  };
}
