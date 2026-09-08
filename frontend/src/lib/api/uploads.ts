import { apiClient } from "./client";
import { UploadResponse } from "@/types";

export const uploadFile = async (
  file: File,
  onUploadProgress?: (progressEvent: any) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<UploadResponse>("/api/v1/uploads", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress,
  });

  return response.data;
};

export const getDemoUpload = async (): Promise<UploadResponse> => {
  const response = await apiClient.get<UploadResponse>("/api/v1/uploads/demo");
  return response.data;
};
