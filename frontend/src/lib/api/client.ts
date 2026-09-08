import axios from "axios";

// Fallback to localhost:8000 if the environment variable is not defined
export const getBaseURL = (): string => {
  let url = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  // Remove trailing slash if present
  url = url.replace(/\/+$/, "");
  // Force HTTPS for production deployment domains to prevent Mixed Content errors
  if (url.includes("up.railway.app") && url.startsWith("http://")) {
    url = url.replace("http://", "https://");
  }
  return url;
};

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 600000, // 10 minutes timeout to handle large raster file uploads
});

