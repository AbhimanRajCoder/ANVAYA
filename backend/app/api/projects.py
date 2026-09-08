import os
from typing import List
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from PIL import Image
from app.schemas import project as schemas
from app.services import project_service
from app.core.logging import logger

router = APIRouter()


@router.post("/", response_model=schemas.ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project_endpoint(project: schemas.ProjectCreate):
    """Create a new survey project record in the database."""
    try:
        return project_service.create_project(project)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create project: {str(e)}"
        )


@router.get("/", response_model=List[schemas.ProjectResponse])
def read_projects_endpoint(skip: int = 0, limit: int = 100):
    """List all survey projects."""
    return project_service.get_projects(skip=skip, limit=limit)


@router.get("/{project_id}", response_model=schemas.ProjectResponse)
def read_project_endpoint(project_id: str):
    """Get details of a single survey project by ID."""
    db_project = project_service.get_project(project_id)
    if db_project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
    return db_project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_endpoint(project_id: str):
    """Delete a survey project and its associated files."""
    success = project_service.delete_project(project_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found or could not be deleted"
        )
    return None


@router.get("/{project_id}/orthomosaic")
def get_project_orthomosaic(project_id: str):
    """
    Exposes a browser-accessible, web-friendly PNG/JPG overview 
    of the project's GeoTIFF orthomosaic image.
    Caches the generated overview on disk.
    """
    db_project = project_service.get_project(project_id)
    if db_project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    filepath = db_project.get("source_file")
    
    from app.services.storage_service import storage_service
    from app.core.config import settings
    try:
        filepath = storage_service.ensure_local_file(filepath, settings.UPLOADS_DIR)
    except Exception as e:
        logger.error(f"Failed to fetch source file from R2: {e}")
        
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orthomosaic file not found on disk or remote storage."
        )
        
    # If the file is already a browser-friendly PNG or JPG, return it directly
    _, ext = os.path.splitext(filepath)
    if ext.lower() in [".png", ".jpg", ".jpeg"]:
        return FileResponse(filepath)
        
    # For GeoTIFFs (.tif, .tiff), generate a downsampled overview PNG image
    cache_filename = f"{project_id}_overview.png"
    cache_path = os.path.join(os.path.dirname(filepath), cache_filename)
    
    if os.path.exists(cache_path):
        return FileResponse(cache_path)
        
    try:
        logger.info(f"Generating browser-friendly overview for GeoTIFF: {filepath}")
        import rasterio
        import numpy as np
        
        with rasterio.open(filepath) as src:
            # Read at downsampled resolution for fast preview loading (max 1024 width/height)
            h = min(src.height, 1024)
            w = min(src.width, 1024)
            
            data = src.read(
                out_shape=(src.count, h, w),
                resampling=rasterio.enums.Resampling.bilinear
            )
            
            # Combine bands to RGB format
            if src.count >= 3:
                rgb = np.dstack((data[0], data[1], data[2]))
            else:
                # Single band / grayscale
                rgb = data[0]
                
            # Normalize pixel ranges to 0-255 uint8 if float / integer
            if rgb.dtype != np.uint8:
                rgb_min = rgb.min()
                rgb_max = rgb.max()
                rgb = ((rgb - rgb_min) / (rgb_max - rgb_min + 1e-5) * 255).astype(np.uint8)
                
            img = Image.fromarray(rgb)
            img.save(cache_path, "PNG")
            
        logger.info(f"Successfully cached orthomosaic preview at: {cache_path}")
        return FileResponse(cache_path)
    except Exception as e:
        logger.error(f"Failed to generate orthomosaic overview using rasterio: {e}")
        # Secondary fallback: try PIL thumbnail directly
        try:
            with Image.open(filepath) as img:
                img.thumbnail((1024, 1024))
                img.save(cache_path, "PNG")
            return FileResponse(cache_path)
        except Exception as pil_err:
            logger.error(f"Overview generation PIL fallback failed: {pil_err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not convert GeoTIFF file to web-accessible format: {str(e)}"
            )
