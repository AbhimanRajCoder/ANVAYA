import { apiClient, getBaseURL } from "./client";
import { GeoJSONFeatureCollection } from "@/types";

export const getBuildings = async (projectId: string): Promise<GeoJSONFeatureCollection> => {
  const response = await apiClient.get<GeoJSONFeatureCollection>(`/api/v1/projects/${projectId}/buildings`);
  return response.data;
};

export interface patchBuildingReviewPayload {
  review_status: string;
  modified_geometry?: any;
  reviewed_by?: string;
  review_comment?: string;
}

export const patchBuildingReview = async (
  projectId: string,
  buildingId: string,
  payload: patchBuildingReviewPayload
): Promise<any> => {
  const response = await apiClient.patch(
    `/api/v1/projects/${projectId}/buildings/${buildingId}`,
    payload
  );
  return response.data;
};

export const getExportUrl = (projectId: string, format: string): string => {
  const baseURL = getBaseURL();
  return `${baseURL}/api/v1/projects/${projectId}/export?format=${format}`;
};

export interface CreateBuildingPayload {
  geometry: any;
  area: number;
  confidence: number;
  review_status?: string;
  reviewed_by?: string;
  review_comment?: string;
}

export const createBuilding = async (
  projectId: string,
  payload: CreateBuildingPayload
): Promise<any> => {
  const response = await apiClient.post(
    `/api/v1/projects/${projectId}/buildings`,
    payload
  );
  return response.data;
};

export const deleteBuilding = async (
  projectId: string,
  buildingId: string
): Promise<any> => {
  const response = await apiClient.delete(
    `/api/v1/projects/${projectId}/buildings/${buildingId}`
  );
  return response.data;
};


