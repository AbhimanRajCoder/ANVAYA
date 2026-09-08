# ANAVYA Backend - Automated Urban Parcel Mapping

ANAVYA is an AI-based automated urban parcel mapping and cadastral feature extraction system using drone imagery. This is the FastAPI-based backend for the application, integrated with **Supabase (PostgreSQL + PostGIS)**.

## Current Scope (MVP Version 1)
This version implements **ONLY Model 1: Building Footprint Detection**. The architecture is modular and extensible to support Model 2 (Parcel Boundary Detection) and Spatial Fusion without restructuring the API design.

---

## 🛠️ Tech Stack
* **Python 3.10+** (Runtime environment)
* **FastAPI** (Web framework)
* **PyTorch** & **Torchvision** (Deep learning model execution)
* **Rasterio** (Geospatial raster/orthomosaic processing)
* **Shapely** (Geospatial vector geometry manipulation)
* **Supabase** (Hosted PostgreSQL + PostGIS database client)

---

## 📂 Project Structure
```text
backend/
│
├── app/
│   ├── main.py                     # Application entry point
│   │
│   ├── api/                        # API routes
│   │   ├── projects.py             # Projects CRUD
│   │   ├── uploads.py              # Image upload & metadata
│   │   ├── processing.py           # Segmentation pipeline trigger
│   │   ├── buildings.py            # GeoJSON building footprints
│   │   └── health.py               # Liveness and readiness probes
│   │
│   ├── models/                     # Deep learning model definition
│   │   ├── base_model.py           # Abstract base class
│   │   ├── model_registry.py       # Modular ML Model Registry
│   │   └── model1_building.py      # Model 1 (DeepLabV3+ ResNet50) loader
│   │
│   ├── services/                   # Business and GIS services
│   │   ├── raster_service.py       # Metadata extraction
│   │   ├── tiling_service.py       # Windowed grid tile generator
│   │   ├── inference_service.py    # Memory-efficient batched inference
│   │   ├── vectorization_service.py# Polygon extraction and UTM calculations
│   │   └── project_service.py      # Database helper service
│   │
│   ├── schemas/                    # Pydantic validation schemas
│   │   ├── project.py
│   │   ├── processing.py
│   │   └── building.py
│   │
│   ├── database/                   # Database setup
│   │   └── database.py             # Supabase client singleton
│   │
│   └── core/                       # Core configuration
│       ├── config.py               # Settings loader
│       └── logging.py              # Log configuration
│
├── storage/                        # Storage for upload and prediction rasters
│   ├── uploads/
│   ├── tiles/
│   ├── predictions/
│   └── exports/
│
├── requirements.txt                # Dependencies list
├── schema.sql                      # Database schema script for Supabase
└── README.md                       # Setup and run manual
```

---

## 🚀 Setup & Execution

### 1. Prerequisite Installations
Ensure PostgreSQL with PostGIS extension is installed and running on your system.
Verify that GDAL is installed (required by rasterio and fiona):
```bash
brew install gdal postgis
```

### 2. Configure Environment Variables
Copy the `.env` template and set your specific Supabase credentials:
```bash
cp .env.example .env
```
Inside `.env`, edit `SUPABASE_URL` and `SUPABASE_KEY` with your credentials:
```ini
SUPABASE_URL=https://unwlqimzdvrdjycuhfen.supabase.co
SUPABASE_KEY=your_service_role_key_here
```

### 3. Setup Supabase Schema
1. Go to your **Supabase Dashboard** for the project `unwlqimzdvrdjycuhfen`.
2. Open the **SQL Editor** tab on the left.
3. Click **New query**.
4. Copy the contents of [`schema.sql`](file:///Users/abhimanraj/ANAVYA-SIH/backend/schema.sql) and paste them into the SQL Editor.
5. Click **Run** to generate the `projects` and `buildings` tables.

### 4. Create a Virtual Environment and Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 5. Running the Backend Server
Start the development server with live-reloads:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📡 API Reference & Endpoints

All mounted V1 endpoints use the prefix `/api/v1`.

### 1. Health Probe
#### `GET /health`
Verify application readiness, Supabase database connection, and Model 1 checkpoint loading status.

* **Request**: None
* **Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "model1": "loaded",
    "database": "connected"
  }
  ```

---

### 2. File Uploads
#### `POST /api/v1/uploads`
Upload a raw orthomosaic file. Validates the file extension, stores the file in `storage/uploads/`, and extracts geospatial metadata.

* **Request**: Form data with a file parameter:
  - `file`: Binary file (Supported: `.tif`, `.tiff`, `.jpg`, `.jpeg`, `.png`)
* **Response (200 OK)**:
  ```json
  {
    "file_id": "8e3cd3d0-32b0-4dbf-859a-1153d103328e",
    "filename": "survey_site_A.tif",
    "stored_filename": "8e3cd3d0-32b0-4dbf-859a-1153d103328e.tif",
    "filepath": "/Users/abhimanraj/ANAVYA-SIH/backend/storage/uploads/8e3cd3d0-32b0-4dbf-859a-1153d103328e.tif",
    "crs": "EPSG:32611",
    "width": 8284,
    "height": 8540,
    "resolution": [0.0314, 0.0314],
    "bounds": [691902.3, 5668796.7, 692162.4, 5669064.9],
    "status": "uploaded"
  }
  ```

---

### 3. Project Management
#### `POST /api/v1/projects`
Create a new survey project mapping to an uploaded orthomosaic file.

* **Request Payload (JSON)**:
  ```json
  {
    "name": "Dehradun Survey Sector 4",
    "description": "High resolution drone mapping of Dehradun sector 4 area.",
    "source_file": "/Users/abhimanraj/ANAVYA-SIH/backend/storage/uploads/8e3cd3d0-32b0-4dbf-859a-1153d103328e.tif",
    "crs": "EPSG:32611",
    "bounds": [691902.3005, 5668796.7672, 692162.4181, 5669064.9232]
  }
  ```
* **Response (210 Created)**:
  ```json
  {
    "id": "c1a0172e-3f62-4b2a-89a1-77884d08ee7a",
    "name": "Dehradun Survey Sector 4",
    "description": "High resolution drone mapping of Dehradun sector 4 area.",
    "source_file": "/Users/abhimanraj/ANAVYA-SIH/backend/storage/uploads/8e3cd3d0-32b0-4dbf-859a-1153d103328e.tif",
    "crs": "EPSG:32611",
    "bounds": [691902.3005, 5668796.7672, 692162.4181, 5669064.9232],
    "status": "UPLOADED",
    "progress": 0,
    "tiles_processed": 0,
    "total_tiles": 0,
    "created_at": "2026-08-27T15:10:00.000Z"
  }
  ```

#### `GET /api/v1/projects`
List all survey projects. Supporting query parameters: `skip` (pagination offset) and `limit` (max records).
* **Response (200 OK)**: Array of project details.

#### `GET /api/v1/projects/{project_id}`
Retrieve details of a single project by its UUID.
* **Response (200 OK)**: Single project detail object.

---

### 4. Processing Pipeline
#### `POST /api/v1/projects/{project_id}/process`
Triggers the asynchronous building footprint extraction pipeline. The task is enqueued in the background using FastAPI's background workers, allowing immediate API response.

* **Response (200 OK)**:
  ```json
  {
    "project_id": "c1a0172e-3f62-4b2a-89a1-77884d08ee7a",
    "status": "PREPROCESSING",
    "message": "Processing pipeline initiated successfully."
  }
  ```

#### `GET /api/v1/projects/{project_id}/status`
Query the progress of the active background job.

* **Response (200 OK)**:
  ```json
  {
    "status": "AI_INFERENCE",
    "progress": 45,
    "tiles_processed": 145,
    "total_tiles": 324,
    "message": "Stage: AI_INFERENCE (45%)"
  }
  ```

##### Pipeline Stages:
* `UPLOADED`: Project created, waiting to start.
* `PREPROCESSING`: Validating source orthomosaic and initializing buffers.
* `TILING`: Constructing overlap-aware grid indices.
* `AI_INFERENCE`: Running Model 1 DeepLabV3+ inference on tiles on Apple Silicon GPU (`mps`) or CPU.
* `VECTORIZATION`: Extracting contours, computing polygon areas in UTM metric space, and computing average pixel confidences.
* `COMPLETED`: Data written to Supabase PostGIS, temporary files deleted.
* `FAILED`: Pipeline failed. Error details logged to console.

---

### 5. Footprint Results
#### `GET /api/v1/projects/{project_id}/buildings`
Retrieve extracted building footprints formatted as a standard GeoJSON FeatureCollection ready for web mapping engines (MapLibre, Leaflet, OpenLayers).

* **Response (200 OK)**:
  ```json
  {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "building_id": "bdf2325c-0975-47e2-a725-3b98c39e235a",
          "area": 245.5,
          "confidence": 0.9412
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [72.84562, 19.12345],
              [72.84575, 19.12345],
              [72.84575, 19.12390],
              [72.84562, 19.12390],
              [72.84562, 19.12345]
            ]
          ]
        }
      }
    ]
  }
  ```
