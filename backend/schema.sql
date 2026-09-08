-- ANAVYA Database Schema Setup for Supabase SQL Editor
-- This script creates the tables and enables the PostGIS extension.

-- 1. Enable PostGIS (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- 2. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    source_file TEXT NOT NULL,
    crs TEXT,
    bounds JSONB, -- [minx, miny, maxx, maxy]
    status TEXT NOT NULL DEFAULT 'UPLOADED',
    progress INTEGER NOT NULL DEFAULT 0,
    tiles_processed INTEGER NOT NULL DEFAULT 0,
    total_tiles INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Buildings Table
CREATE TABLE IF NOT EXISTS public.buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    area DOUBLE PRECISION NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    review_status TEXT DEFAULT 'AI_DETECTED',
    modified_geometry GEOMETRY(Polygon, 4326),
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Spatial Index for Fast Querying
CREATE INDEX IF NOT EXISTS buildings_geometry_idx ON public.buildings USING gist(geometry);

-- 5. Expose tables to PostgREST
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous select/insert/update/delete for SIH MVP
-- (You can restrict this later with authentication)
CREATE POLICY "Allow all public projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public buildings" ON public.buildings FOR ALL USING (true) WITH CHECK (true);

-- 6. Upgrade Migration Script (for pre-existing databases)
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'AI_DETECTED';
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS modified_geometry GEOMETRY(Polygon, 4326);
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS review_comment TEXT;

