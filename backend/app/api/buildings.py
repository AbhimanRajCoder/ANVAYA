import json
import os
import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, status, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.database import supabase
from app.services import project_service, export_service, review_service
from app.schemas.building import BuildingReviewUpdate
from app.core.logging import logger

router = APIRouter()

def clean_temp_export_file(filepath: str):
    """Background task to remove a temporary export file/directory from disk after download completes."""
    try:
        if os.path.exists(filepath):
            if os.path.isdir(filepath):
                import shutil
                shutil.rmtree(filepath)
            else:
                os.remove(filepath)
            logger.info(f"Successfully cleaned up temporary export file: {filepath}")
    except Exception as e:
        logger.warning(f"Failed to clean up temporary export file {filepath}: {e}")


@router.get("/{project_id}/buildings")
def get_project_buildings_geojson(project_id: str):
    """
    Retrieve building footprints for a project.
    Returns results as a standard GeoJSON FeatureCollection.
    Merges local SQLite overrides if Supabase PostGIS lacks the review columns.
    """
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    try:
        # 1. Query buildings from Supabase
        try:
            res = supabase.table("buildings")\
                .select("id, area, confidence, geometry, review_status, modified_geometry, reviewed_by, reviewed_at, review_comment")\
                .eq("project_id", project_id)\
                .execute()
        except Exception as select_err:
            logger.info(f"Supabase full column select failed: {select_err}. Falling back to base columns.")
            res = supabase.table("buildings")\
                .select("id, area, confidence, geometry")\
                .eq("project_id", project_id)\
                .execute()

        # 2. Get local SQLite review overrides (if Supabase schema is unmigrated or client holds local cached updates)
        local_reviews = review_service.get_local_reviews(project_id)

        features = []
        supabase_ids = set()

        for row in (res.data or []):
            b_id = row["id"]
            supabase_ids.add(b_id)
            
            # Skip if locally deleted
            if b_id in local_reviews and local_reviews[b_id].get("review_status") == "DELETED":
                continue
                
            geom = row.get("geometry")
            
            # Default properties dictionary
            props = {
                "building_id": b_id,
                "area": row["area"],
                "confidence": row["confidence"],
                "review_status": row.get("review_status") or "AI_DETECTED",
                "reviewed_by": row.get("reviewed_by"),
                "reviewed_at": row.get("reviewed_at"),
                "review_comment": row.get("review_comment")
            }
            
            # Apply local SQLite overrides if present
            if b_id in local_reviews:
                override = local_reviews[b_id]
                props.update({
                    "review_status": override["review_status"],
                    "reviewed_by": override["reviewed_by"],
                    "reviewed_at": override["reviewed_at"],
                    "review_comment": override["review_comment"]
                })
                # If geometry was modified by reviewer, use that
                if override.get("modified_geometry"):
                    geom = override["modified_geometry"]

            # Unpack JSON properties from review_comment if present
            comment_str = props.get("review_comment")
            if comment_str:
                try:
                    metadata = json.loads(comment_str)
                    if isinstance(metadata, dict):
                        actual_comment = metadata.pop("comment", "")
                        props.update(metadata)
                        props["review_comment"] = actual_comment
                except Exception:
                    pass

            # Handle case where geometry might be returned as JSON string, WKB, or WKT
            if isinstance(geom, str):
                try:
                    geom = json.loads(geom)
                except Exception:
                    try:
                        import shapely.wkb
                        import shapely.wkt
                        from shapely.geometry import mapping
                        try:
                            # PostgREST typically returns PostGIS geometry as EWKB Hex string
                            parsed_geom = shapely.wkb.loads(geom, hex=True)
                        except Exception:
                            # Fallback to WKT
                            parsed_geom = shapely.wkt.loads(geom)
                        geom = mapping(parsed_geom)
                    except Exception as e:
                        logger.warning(f"Could not parse geometry string (not JSON, WKB, or WKT). Error: {e}")
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": geom
            })

        # 3. Merge newly created features from local reviews
        for b_id, override in local_reviews.items():
            if b_id not in supabase_ids and override.get("review_status") == "CREATED":
                geom = override.get("modified_geometry")
                
                # Default properties
                props = {
                    "building_id": b_id,
                    "area": 0.0,
                    "confidence": 1.0,
                    "review_status": "CREATED",
                    "reviewed_by": override.get("reviewed_by") or "Surveyor",
                    "reviewed_at": override.get("reviewed_at"),
                    "review_comment": override.get("review_comment")
                }
                
                # Unpack JSON properties from review_comment if present
                comment_str = props.get("review_comment")
                if comment_str:
                    try:
                        metadata = json.loads(comment_str)
                        if isinstance(metadata, dict):
                            actual_comment = metadata.pop("comment", "")
                            props.update(metadata)
                            props["review_comment"] = actual_comment
                    except Exception:
                        pass
                
                # Try to compute area if polygon
                if geom and geom.get("type") == "Polygon" and props["area"] == 0.0:
                    try:
                        from shapely.geometry import shape
                        props["area"] = shape(geom).area * 111319 * 111319
                    except Exception:
                        pass
                        
                features.append({
                    "type": "Feature",
                    "properties": props,
                    "geometry": geom
                })

        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
        logger.error(f"Failed to query building footprints for project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query building footprints: {str(e)}"
        )



@router.patch("/{project_id}/buildings/{building_id}")
def update_building_review(
    project_id: str,
    building_id: str,
    payload: BuildingReviewUpdate
):
    """
    Update the QA review status and geometry modifications for a building footprint.
    First attempts to update Supabase. If table columns do not exist, falls back to SQLite.
    """
    logger.info(f"PATCH: Received review status '{payload.review_status}' for building {building_id}")
    
    # 1. Prepare fields to update
    update_data = {
        "review_status": payload.review_status,
        "reviewed_by": payload.reviewed_by,
        "review_comment": payload.review_comment,
        "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    if payload.review_status == "EDITED" and payload.modified_geometry:
        try:
            from shapely.geometry import shape
            wkt_geom = shape(payload.modified_geometry).wkt
            update_data["geometry"] = wkt_geom  # WKT geometry is parsed by PostGIS
            update_data["modified_geometry"] = wkt_geom
        except Exception as e:
            logger.error(f"Failed to parse modified geometry to WKT: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid GeoJSON geometry format provided."
            )
            
    # 2. Try writing to Supabase
    try:
        supabase.table("buildings").update(update_data).eq("id", building_id).execute()
        logger.info(f"Successfully saved QA review to Supabase for building {building_id}")
        return {"status": "success", "source": "supabase"}
    except Exception as e:
        # Check if column doesn't exist, log warning, fallback to SQLite
        logger.warning(
            f"Supabase update failed for building {building_id}: {e}. "
            f"Falling back to local SQLite review store."
        )
        
        try:
            review_service.save_local_review(project_id, building_id, payload.dict())
            return {"status": "success", "source": "sqlite"}
        except Exception as sq_err:
            logger.error(f"Fallback SQLite review saving failed: {sq_err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save review to database or fallback SQLite: {str(e)}"
            )


@router.get("/{project_id}/export")
def export_project_buildings(
    project_id: str,
    background_tasks: BackgroundTasks,
    format: str = Query("geojson", pattern="^(geojson|shp|gpkg)$")
):
    """
    Export validated building footprints for a project.
    Excludes rejected predictions (review_status == 'REJECTED') from export datasets.
    Supports GeoJSON, ESRI Shapefile (zipped), and GeoPackage formats.
    """
    logger.info(f"Export requested for project {project_id} in format: {format}")
    
    # 1. Fetch buildings GeoJSON using existing method (which applies overrides)
    geojson_data = get_project_buildings_geojson(project_id)
    features = geojson_data.get("features", [])
    
    if not features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No building footprints found for this project to export."
        )
        
    # 2. Generate export using export service
    try:
        filepath = export_service.generate_export(project_id, format, features)
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Export file was not found on server disk: {filepath}")
            
        # 3. Queue clean up tasks for temporary export files
        background_tasks.add_task(clean_temp_export_file, filepath)
        
        # Determine media type and filename
        media_type = "application/octet-stream"
        filename = os.path.basename(filepath)
        
        if format == "geojson":
            media_type = "application/json"
        elif format == "shp":
            media_type = "application/zip"
            filename = f"anavya_survey_{project_id}_shapefile.zip"
        elif format == "gpkg":
            media_type = "application/geopackage+sqlite3"
            filename = f"anavya_survey_{project_id}.gpkg"
            
        return FileResponse(
            path=filepath,
            media_type=media_type,
            filename=filename
        )
        
    except ValueError as val_err:
        logger.error(f"Validation error generating export: {val_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as e:
        logger.error(f"Failed to generate export file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export generation failed: {str(e)}"
        )


class BuildingCreatePayload(BaseModel):
    geometry: Dict[str, Any]
    area: float
    confidence: float
    review_status: str = "CREATED"
    reviewed_by: Optional[str] = "Surveyor"
    review_comment: Optional[str] = None


@router.post("/{project_id}/buildings")
def create_building_footprint(
    project_id: str,
    payload: BuildingCreatePayload
):
    """
    Create a new building/annotation footprint.
    First attempts to insert into Supabase. If table schema or column prevents it, falls back to SQLite.
    """
    import uuid
    building_id = str(uuid.uuid4())
    logger.info(f"POST: Creating new building/annotation footprint {building_id} for project {project_id}")

    # Prepare insert data for Supabase
    # PostGIS expects WKT or GeoJSON structure
    wkt_geom = None
    try:
        from shapely.geometry import shape
        wkt_geom = shape(payload.geometry).wkt
    except Exception as e:
        logger.error(f"Failed to parse geometry to WKT for insertion: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GeoJSON geometry format provided."
        )

    insert_data = {
        "id": building_id,
        "project_id": project_id,
        "geometry": wkt_geom,
        "area": payload.area,
        "confidence": payload.confidence,
        "review_status": payload.review_status,
        "reviewed_by": payload.reviewed_by,
        "review_comment": payload.review_comment,
        "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    try:
        supabase.table("buildings").insert(insert_data).execute()
        logger.info(f"Successfully inserted building footprint to Supabase for {building_id}")
        return {"status": "success", "source": "supabase", "building_id": building_id}
    except Exception as e:
        logger.warning(
            f"Supabase insert failed for building {building_id}: {e}. "
            f"Falling back to local SQLite review store."
        )
        try:
            # We save the created feature as a local review override with status 'CREATED'
            sqlite_payload = {
                "review_status": payload.review_status,
                "modified_geometry": payload.geometry,
                "reviewed_by": payload.reviewed_by,
                "review_comment": payload.review_comment,
                "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            # Wrap area and confidence in a JSON review_comment metadata block
            comment_metadata = {
                "area": payload.area,
                "confidence": payload.confidence,
                "comment": payload.review_comment or ""
            }
            sqlite_payload["review_comment"] = json.dumps(comment_metadata)
            review_service.save_local_review(project_id, building_id, sqlite_payload)
            return {"status": "success", "source": "sqlite", "building_id": building_id}
        except Exception as sq_err:
            logger.error(f"Fallback SQLite creation failed: {sq_err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create building in database: {str(e)}"
            )


@router.delete("/{project_id}/buildings/{building_id}")
def delete_building_footprint(
    project_id: str,
    building_id: str
):
    """
    Delete a building footprint.
    First attempts to delete from Supabase. If Supabase fails, records a local 'DELETED' review in SQLite.
    If the building only exists locally (created locally), we delete it from SQLite.
    """
    logger.info(f"DELETE: Removing building footprint {building_id} for project {project_id}")

    supabase_success = False
    try:
        res = supabase.table("buildings").delete().eq("id", building_id).execute()
        if res.data:
            supabase_success = True
            logger.info(f"Successfully deleted building {building_id} from Supabase.")
    except Exception as e:
        logger.warning(f"Supabase delete failed for building {building_id}: {e}")

    # Fallback to local reviews SQLite
    try:
        local_reviews = review_service.get_local_reviews(project_id)
        if building_id in local_reviews:
            review_service.delete_local_review(building_id)
            logger.info(f"Deleted local override/creation for building {building_id} from SQLite.")
        
        if not supabase_success:
            delete_payload = {
                "review_status": "DELETED",
                "modified_geometry": None,
                "reviewed_by": "Surveyor",
                "review_comment": "Deleted by user",
                "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            review_service.save_local_review(project_id, building_id, delete_payload)
            logger.info(f"Recorded local DELETED status for building {building_id} in SQLite.")
            
        return {"status": "success", "deleted_id": building_id}
    except Exception as sq_err:
        logger.error(f"Failed to delete building locally in SQLite: {sq_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete building: {str(sq_err)}"
        )

