import { apiClient } from "./client";
import { SystemHealth } from "@/types";

export const getSystemHealth = async (): Promise<SystemHealth> => {
  const response = await apiClient.get<SystemHealth>("/health");
  return response.data;
};
