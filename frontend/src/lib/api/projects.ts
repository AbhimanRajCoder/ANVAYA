import { apiClient } from "./client";
import { Project } from "@/types";

export const getProjects = async (): Promise<Project[]> => {
  const response = await apiClient.get<Project[]>("/api/v1/projects");
  return response.data;
};

export const getProject = async (projectId: string): Promise<Project> => {
  const response = await apiClient.get<Project>(`/api/v1/projects/${projectId}`);
  return response.data;
};

export interface CreateProjectPayload {
  name: string;
  description: string;
  source_file: string;
  crs: string;
  bounds: number[];
}

export const createProject = async (projectData: CreateProjectPayload): Promise<Project> => {
  const response = await apiClient.post<Project>("/api/v1/projects", projectData);
  return response.data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/projects/${projectId}`);
};
