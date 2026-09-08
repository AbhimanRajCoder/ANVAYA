import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, status, BackgroundTasks

from app.core.config import settings
from app.services import raster_service
from app.core.logging import logger

router = APIRouter()

ALLOWED_EXTENSIONS = {".tif", ".tiff", ".jpg", ".jpeg", ".png"}

def background_upload_to_r2(local_filepath: str, stored_filename: str):
    from app.services.storage_service import storage_service
    if storage_service.is_configured():
        object_key = f"uploads/{stored_filename}"
        success = storage_service.upload_file(local_filepath, object_key)
        if success and os.path.exists(local_filepath):
            os.remove(local_filepath)


@router.post("")
@router.post("/", include_in_schema=False)
async def upload_file(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Upload a drone image or GeoTIFF orthomosaic.
    Extracts geospatial metadata (CRS, bounds, resolution) and stores the file.
    """
    filename = file.filename
    _, ext = os.path.splitext(filename)
    
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}{ext}"
    filepath = os.path.join(settings.UPLOADS_DIR, stored_filename)

    logger.info(f"Saving uploaded file: {filename} to {filepath}")
    
    # Save the uploaded stream to disk
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file on backend storage."
        )

    # Extract metadata using raster_service
    try:
        meta = raster_service.get_raster_metadata(filepath)
        
        # Upload to R2 if configured via background task
        from app.services.storage_service import storage_service
        final_filepath = filepath
        if storage_service.is_configured():
            final_filepath = f"r2://uploads/{stored_filename}"
            background_tasks.add_task(background_upload_to_r2, filepath, stored_filename)
            
        return {
            "file_id": file_id,
            "filename": filename,
            "stored_filename": stored_filename,
            "filepath": final_filepath,
            "crs": meta["crs"],
            "width": meta["width"],
            "height": meta["height"],
            "resolution": meta["resolution"],
            "bounds": meta["bounds"],
            "status": "uploaded"
        }
    except Exception as e:
        logger.error(f"Failed to extract metadata: {e}")
        # Clean up corrupted/invalid upload
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Image upload parsed successfully but metadata extraction failed: {str(e)}"
        )


@router.get("/demo")
def get_demo_metadata():
    """Return mock metadata for the sample test file uploaded to R2."""
    return {
        "file_id": "demo-test-id",
        "filename": "Sample-Test-Image.tif",
        "stored_filename": "test_62533e4f-589a-49d6-aa08-87e454017469.tif",
        "filepath": "r2://test-uploads/test_62533e4f-589a-49d6-aa08-87e454017469.tif",
        "crs": "EPSG:32611",
        "width": 1024,
        "height": 1024,
        "resolution": [0.05, 0.05],
        "bounds": [
            -114.25662970011444, 51.140832788196306,
            -114.25291583186524, 51.14074555503784,
            -114.2530588793002, 51.138336957884576,
            -114.25677255475101, 51.138424183585585
        ],
        "status": "uploaded"
    }
