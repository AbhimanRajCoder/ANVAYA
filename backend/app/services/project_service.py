import os
from typing import List, Dict, Any, Optional
from app.database import supabase
from app.schemas import project as project_schemas
from app.core.logging import logger


def create_project(project: project_schemas.ProjectCreate) -> Dict[str, Any]:
    """Create a new project record in the Supabase projects table."""
    try:
        res = supabase.table("projects").insert({
            "name": project.name,
            "description": project.description,
            "source_file": project.source_file,
            "crs": project.crs,
            "bounds": project.bounds,
            "status": "UPLOADED",
            "progress": 0
        }).execute()
        
        if not res.data:
            raise RuntimeError("Insert returned empty data.")
        return res.data[0]
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise e


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a project by its unique UUID from Supabase."""
    try:
        res = supabase.table("projects").select("*").eq("id", project_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Error fetching project {project_id}: {e}")
        return None


def get_projects(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieve lists of projects sorted by creation date with pagination."""
    try:
        res = supabase.table("projects")\
            .select("*")\
            .order("created_at", desc=True)\
            .range(skip, skip + limit - 1)\
            .execute()
        return res.data if res.data else []
    except Exception as e:
        logger.error(f"Error fetching projects list: {e}")
        return []


def update_project_status(
    project_id: str,
    status: str,
    progress: int,
    tiles_processed: int = 0,
    total_tiles: int = 0
) -> Optional[Dict[str, Any]]:
    """Update status, progress, and tile metrics of a project in Supabase."""
    try:
        update_data = {
            "status": status,
            "progress": progress
        }
        if tiles_processed > 0:
            update_data["tiles_processed"] = tiles_processed
        if total_tiles > 0:
            update_data["total_tiles"] = total_tiles

        res = supabase.table("projects").update(update_data).eq("id", project_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Error updating project {project_id} status: {e}")
        return None


def save_buildings(project_id: str, vectorized_buildings: List[Dict[str, Any]]) -> None:
    """
    Save vectorized building footprints to the Supabase buildings table.
    Clears existing footprints for this project first, then inserts the new ones.
    """
    logger.info(f"Saving {len(vectorized_buildings)} building footprints for project {project_id} in Supabase")
    try:
        # Clear existing building footprints for re-runs
        supabase.table("buildings").delete().eq("project_id", project_id).execute()

        # Batch insert building records
        records = []
        for b in vectorized_buildings:
            # We serialize the geometry to WKT (Well-Known Text)
            # Supabase PostGIS automatically parses WKT geometry strings on insert
            wkt_geom = b["geometry"].wkt
            records.append({
                "project_id": project_id,
                "geometry": wkt_geom,
                "area": b["area"],
                "confidence": b["confidence"]
            })

        # Insert batch
        if records:
            # PostgREST handles batch insert efficiently
            supabase.table("buildings").insert(records).execute()
        logger.info(f"Successfully saved all building footprints to Supabase database.")
    except Exception as e:
        logger.error(f"Error saving building footprints to Supabase: {e}")
        raise e


def delete_project(project_id: str) -> bool:
    """
    Delete a project and its associated building records from Supabase.
    Also attempts to clean up the uploaded source file from disk.
    """
    try:
        # Get project details first to find the source file
        project = get_project(project_id)
        
        if project:
            # 1. Delete associated buildings
            supabase.table("buildings").delete().eq("project_id", project_id).execute()
            
            # 2. Delete the project record
            supabase.table("projects").delete().eq("id", project_id).execute()
            
            # 3. Clean up the physical file on disk if it exists
            filepath = project.get("source_file")
            if filepath and os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"Deleted source file: {filepath}")
                
                # Try to clean up cached preview if it exists
                cache_filename = f"{project_id}_overview.png"
                cache_path = os.path.join(os.path.dirname(filepath), cache_filename)
                if os.path.exists(cache_path):
                    os.remove(cache_path)
                    logger.info(f"Deleted cached preview: {cache_path}")
            
            logger.info(f"Successfully deleted project {project_id}")
            return True
        return False
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        return False
