export type ProjectStatus =
  | "UPLOADED"
  | "PREPROCESSING"
  | "TILING"
  | "AI_INFERENCE"
  | "VECTORIZATION"
  | "COMPLETED"
  | "FAILED";

export const getProjectStatusLabel = (status: string): string => {
  switch (status) {
    case "UPLOADED":
      return "Data Uploaded";
    case "PREPROCESSING":
      return "Preprocessing";
    case "TILING":
      return "Image Tiling";
    case "AI_INFERENCE":
      return "AI Footprint Inference";
    case "VECTORIZATION":
      return "Vectorization";
    case "COMPLETED":
      return "Analysis Complete";
    case "FAILED":
      return "Execution Failed";
    default:
      return status;
  }
};

export const getProjectStatusColor = (status: string): string => {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-950/40 text-emerald-400 border-emerald-900/50";
    case "FAILED":
      return "bg-red-950/40 text-red-400 border-red-900/50";
    case "UPLOADED":
      return "bg-zinc-800 text-zinc-300 border-zinc-700";
    case "PREPROCESSING":
    case "TILING":
    case "AI_INFERENCE":
    case "VECTORIZATION":
      return "bg-indigo-950/40 text-indigo-400 border-indigo-900/50 animate-pulse";
    default:
      return "bg-zinc-900 text-zinc-400 border-zinc-800";
  }
};

export const isProcessing = (status: string): boolean => {
  return ["PREPROCESSING", "TILING", "AI_INFERENCE", "VECTORIZATION"].includes(status);
};

export const isCompleted = (status: string): boolean => {
  return status === "COMPLETED";
};

export const isFailed = (status: string): boolean => {
  return status === "FAILED";
};
