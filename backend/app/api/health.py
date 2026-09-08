from fastapi import APIRouter, UploadFile, File
from app.database import supabase
from app.models import model_registry
from app.core.logging import logger

router = APIRouter()


@router.get("/health")
def health_check():
    """Check application health: Supabase connection and Model 1 status."""
    health_status = {
        "status": "ok",
        "model1": "not_loaded",
        "database": "disconnected"
    }

    # Verify Supabase Connection
    try:
        if supabase is not None:
            supabase.table("projects").select("id").limit(1).execute()
            health_status["database"] = "connected"
        else:
            health_status["status"] = "error"
    except Exception as e:
        logger.error(f"Health Check: Supabase connection failed: {e}")
        health_status["status"] = "error"

    # Verify ML Model Loading
    try:
        model = model_registry.get_model("model1_building")
        if model.model is not None:
            health_status["model1"] = "loaded"
    except Exception as e:
        logger.warning(f"Health Check: Model 1 not loaded or failed: {e}")

    return health_status

@router.post("/r2-test")
async def test_r2_upload(file: UploadFile = File(...)):
    """Simple endpoint to test Cloudflare R2 uploads."""
    from app.services.storage_service import storage_service
    import shutil
    import os
    import uuid
    from fastapi import HTTPException
    
    if not storage_service.is_configured():
        raise HTTPException(status_code=500, detail="R2 is not configured in .env")
        
    filename = file.filename
    _, ext = os.path.splitext(filename)
    file_id = str(uuid.uuid4())
    stored_filename = f"test_{file_id}{ext}"
    
    from app.core.config import settings
    local_path = os.path.join(settings.UPLOADS_DIR, stored_filename)
    
    try:
        # Save locally first
        with open(local_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Upload to R2
        object_key = f"test-uploads/{stored_filename}"
        success = storage_service.upload_file(local_path, object_key)
        
        if success:
            # Generate a presigned URL to prove it works
            presigned_url = storage_service.generate_presigned_url(object_key)
            
            # Clean up local temp file
            if os.path.exists(local_path):
                os.remove(local_path)
                
            return {
                "status": "success",
                "message": "File successfully uploaded to Cloudflare R2!",
                "r2_uri": f"r2://{object_key}",
                "presigned_url": presigned_url
            }
        else:
            raise HTTPException(status_code=500, detail="Upload to R2 failed (check backend logs)")
            
    except Exception as e:
        if os.path.exists(local_path):
            os.remove(local_path)
        raise HTTPException(status_code=500, detail=f"Error processing test upload: {e}")
