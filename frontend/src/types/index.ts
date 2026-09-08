export interface Project {
  id: string;
  name: string;
  description: string | null;
  source_file: string;
  crs: string | null;
  bounds: number[] | null; // [minx, miny, maxx, maxy]
  status: string; // UPLOADED, PREPROCESSING, TILING, AI_INFERENCE, VECTORIZATION, COMPLETED, FAILED
  progress: number;
  tiles_processed: number;
  total_tiles: number;
  created_at: string;
}

export interface UploadResponse {
  file_id: string;
  filename: string;
  stored_filename: string;
  filepath: string;
  crs: string;
  width: number;
  height: number;
  resolution: number[];
  bounds: number[];
  status: string;
}

export interface ProcessingStatus {
  status: string;
  progress: number;
  tiles_processed: number;
  total_tiles: number;
  message: string | null;
  logs: string[];
}

export interface GeoJSONFeature {
  type: "Feature";
  properties: {
    building_id: string;
    area: number;
    confidence: number;
    [key: string]: any;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon" | "LineString" | "Point";
    coordinates: any;
  };
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface SystemHealth {
  status: string; // ok, error
  model1: string; // loaded, not_loaded
  database: string; // connected, disconnected
}
