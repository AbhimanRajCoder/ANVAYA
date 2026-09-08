import axios from "axios";

// Fallback to localhost:8000 if the environment variable is not defined
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 600000, // 10 minutes timeout to handle large raster file uploads
});
