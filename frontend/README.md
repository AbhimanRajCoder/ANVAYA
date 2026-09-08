# ANAVYA - Frontend Application

This is the frontend component of **ANAVYA**, an AI-Based Automated Urban Parcel Mapping & Cadastral Feature Extraction System. 
It provides a high-quality, production-ready interface for geospatial intelligence, empowering urban planning teams, surveyors, and GIS professionals to seamlessly upload orthomosaic drone imagery and visualize AI-extracted building footprints in a high-performance WebGL mapping environment.

## 🚀 Tech Stack

The frontend is built with a modern, high-performance web architecture:

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + Turbopack for rapid development.
- **Language**: [TypeScript](https://www.typescriptlang.org/) for robust, type-safe development.
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) for beautiful, utility-first CSS styling and dark mode integration.
- **Maps**: [MapLibre GL JS](https://maplibre.org/) for lightning-fast, WebGL-powered vector tile rendering and geospatial data visualization.
- **Icons**: [Lucide React](https://lucide.dev/) for crisp, consistent iconography.
- **HTTP Client**: [Axios](https://axios-http.com/) for resilient API communication.

## 🏗️ Project Structure

```
frontend/
├── public/                 # Static assets
│   └── maplibre/           # MapLibre Worker and Shared module (Required for Turbopack)
├── src/
│   ├── app/                # Next.js App Router pages and layouts
│   │   ├── dashboard/      # User dashboard view
│   │   ├── projects/       # Dynamic routes for GIS workspace, upload wizards, etc.
│   │   └── globals.css     # Global CSS and Tailwind directives
│   ├── components/         # Reusable React components
│   │   ├── layout/         # Application shell, header, sidebar
│   │   ├── map/            # GIS MapWorkspace and controls
│   │   ├── projects/       # Project lists and cards
│   │   └── upload/         # New survey upload wizard
│   ├── hooks/              # Custom React hooks (e.g., useBuildings, useProjects)
│   ├── lib/
│   │   └── api/            # Axios API clients for backend integration
│   └── types/              # TypeScript interfaces and type definitions
├── .env.local              # Local environment variables
└── package.json            # Project dependencies and scripts
```

## ⚙️ Setup & Installation

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) and `npm` installed.

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file in the root of the `frontend` directory (if not already present):
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
   *(Ensure your FastAPI backend is running on the corresponding port).*

## 🏃‍♂️ Running the Application

### Development Server

Start the development server with Turbopack for instant HMR (Hot Module Replacement):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to access the ANAVYA platform.

### Production Build

To build the application for production:

```bash
npm run build
```

To start the production server:

```bash
npm run start
```

## 🗺️ GIS Map Integration Notes (MapLibre GL JS v6)

ANAVYA uses **MapLibre GL JS v6**. Because Next.js Turbopack currently has specific requirements for resolving ESM Web Workers, we manually serve the MapLibre web worker files as static assets.

- The files `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` must reside in `public/maplibre/`.
- In `MapWorkspace.tsx`, we initialize the worker explicitly:
  ```typescript
  import { setWorkerUrl } from "maplibre-gl";
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  ```
- To avoid Server-Side Rendering (SSR) issues with `window` objects, the map component is dynamically imported in Next.js:
  ```typescript
  import dynamic from "next/dynamic";
  const MapWorkspace = dynamic(() => import("@/components/map/MapWorkspace"), { ssr: false });
  ```

## 🔗 Backend API Integration

The frontend seamlessly connects to the Python FastAPI backend via Axios clients located in `src/lib/api/`. 

Key integration points:
- **Project Management**: `GET /api/v1/projects`
- **Data Uploads**: `POST /api/v1/uploads/presigned-url`
- **Pipeline Execution**: `POST /api/v1/projects/{id}/process`
- **Geospatial Results**: `GET /api/v1/projects/{id}/buildings` (Returns PostGIS data as a standard GeoJSON FeatureCollection).
