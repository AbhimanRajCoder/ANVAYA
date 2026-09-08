import { apiClient } from "./client";
import { ProcessingStatus } from "@/types";

export interface StartProcessingResponse {
  project_id: string;
  status: string;
  message: string;
}

export const startProcessing = async (projectId: string): Promise<StartProcessingResponse> => {
  const response = await apiClient.post<StartProcessingResponse>(`/api/v1/projects/${projectId}/process`, {});
  return response.data;
};

export const getProcessingStatus = async (projectId: string): Promise<ProcessingStatus> => {
  const response = await apiClient.get<ProcessingStatus>(`/api/v1/projects/${projectId}/status`);
  return response.data;
};
