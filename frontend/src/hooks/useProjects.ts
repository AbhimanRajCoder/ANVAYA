import { useState, useEffect, useCallback } from "react";
import { Project } from "@/types";
import { getProjects } from "@/lib/api/projects";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err: any) {
      console.error("Error in useProjects hook:", err);
      setError(err.message || "Failed to load projects. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    refreshProjects: fetchProjects,
  };
}
