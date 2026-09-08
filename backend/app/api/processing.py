import os
import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from app.models import model_registry
from app.schemas import processing as schemas
from app.services import project_service, inference_service, vectorization_service
from app.core.config import settings
from app.core.logging import logger

router = APIRouter()


IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def add_project_log(project_id: str, message: str):
    """Write a timestamped log message to a log file for the project (in IST time)."""
    try:
        log_dir = os.path.join(settings.BASE_STORAGE_DIR, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, f"{project_id}.log")
        
        timestamp = datetime.datetime.now(IST).strftime("%H:%M:%S")
        log_line = f"[{timestamp}] {message}"
        
        with open(log_file, "a") as f:
            f.write(log_line + "\n")
    except Exception as e:
        logger.error(f"Failed to write log for project {project_id}: {e}")


def get_project_logs(project_id: str) -> list[str]:
    """Read all log lines for a project."""
    log_file = os.path.join(settings.BASE_STORAGE_DIR, "logs", f"{project_id}.log")
    if not os.path.exists(log_file):
        return []
    try:
        with open(log_file, "r") as f:
            return [line.strip() for line in f.readlines()]
    except Exception:
        return []


def execute_pipeline(project_id: str):
    """
    Background worker thread function executing the full processing pipeline:
    Tiling -> Model 1 Inference -> Mask Generation -> Vectorization -> Supabase Storage.
    """
    logger.info(f"Worker: Starting pipeline for project {project_id}")
    
    # 0. Clear existing logs
    log_file = os.path.join(settings.BASE_STORAGE_DIR, "logs", f"{project_id}.log")
    if os.path.exists(log_file):
        try:
            os.remove(log_file)
        except Exception:
            pass

    add_project_log(project_id, "INFO: Starting AI Cadastral Feature Extraction Pipeline.")
    
    prediction_filepath = None
    try:
        # 1. Start Preprocessing
        add_project_log(project_id, "INFO [Step 1/5]: Loading project metadata and verifying source file...")
        project_service.update_project_status(project_id, "PREPROCESSING", 5)
        project = project_service.get_project(project_id)
        if not project:
            err_msg = f"ERROR: Project {project_id} not found in database."
            add_project_log(project_id, err_msg)
            logger.error(f"Worker: {err_msg}")
            return
            
        # Verify file exists (skip local check if it's in R2)
        source_file = project["source_file"]
        if not source_file.startswith("r2://") and not os.path.exists(source_file):
            raise FileNotFoundError(f"Project source file not found at: {source_file}")
            
        add_project_log(project_id, f"INFO: Verified source file: {os.path.basename(source_file)}")
        add_project_log(project_id, f"INFO: Reference Coordinate System: {project.get('crs', 'Local Grid')}")

        # 2. Tiling stage
        add_project_log(project_id, "INFO [Step 2/5]: Initializing overlap-aware tiling grid indices...")
        project_service.update_project_status(project_id, "TILING", 15)

        # 3. Running AI Inference (Model 1)
        add_project_log(project_id, "INFO [Step 3/5]: Instantiating Model 1 (DeepLabV3+ with ResNet50 backbone)...")
        
        try:
            model1 = model_registry.get_model("model1_building")
            device_name = str(getattr(model1, "device", "cpu"))
        except Exception:
            device_name = "cpu"
        
        if "cuda" in device_name:
            device_desc = f"NVIDIA CUDA GPU ({device_name})"
        elif "mps" in device_name:
            device_desc = f"Apple Silicon GPU ({device_name})"
        else:
            device_desc = f"CPU ({device_name})"

        add_project_log(project_id, f"INFO: Mapping model execution to {device_desc} accelerator...")
        
        # Progress callback updates progress value in the range [20%, 80%]
        def progress_callback(processed: int, total: int):
            progress_pct = int(20 + (processed / total) * 60)
            project_service.update_project_status(
                project_id, "AI_INFERENCE", progress_pct,
                tiles_processed=processed, total_tiles=total
            )
            # Log every 10 tiles, or on first/last tiles
            if processed == 1 or processed == total or processed % 15 == 0:
                add_project_log(
                    project_id, 
                    f"AI MODEL: Running segmentation: tile {processed}/{total} processed ({progress_pct}% completion)"
                )

        # Triggers tiling + batched PyTorch inference
        prediction_filepath = inference_service.run_building_inference(
            project["source_file"], project_id, progress_callback=progress_callback
        )
        
        add_project_log(project_id, "INFO: Finished AI inference. Probability mask compiled successfully.")

        # 4. Vectorization stage
        add_project_log(project_id, "INFO [Step 4/5]: Running contour vectorization and geometry simplification...")
        project_service.update_project_status(project_id, "VECTORIZATION", 85)
        
        vectorized_buildings = vectorization_service.vectorize_mask(
            prediction_filepath, 
            threshold=0.5, 
            min_area=5.0  # Discard objects smaller than 5 square meters
        )
        
        add_project_log(project_id, f"INFO: Extracted {len(vectorized_buildings)} building footprint polygons (> 5m²).")

        # 5. Saving polygons to Supabase database (PostGIS)
        add_project_log(project_id, "INFO [Step 5/5]: Bulk inserting WKT geometries into Supabase PostGIS...")
        project_service.update_project_status(project_id, "VECTORIZATION", 95)
        project_service.save_buildings(project_id, vectorized_buildings)

        # 6. Success Cleanup and Completion
        project_service.update_project_status(project_id, "COMPLETED", 100)
        add_project_log(project_id, f"SUCCESS: Feature extraction completed successfully. Mapped {len(vectorized_buildings)} buildings.")
        logger.info(f"Worker: Pipeline completed successfully for project {project_id}.")

    except Exception as e:
        err_msg = f"ERROR: Pipeline execution failed: {str(e)}"
        add_project_log(project_id, err_msg)
        logger.error(f"Worker: Pipeline failed for project {project_id}: {e}")
        project_service.update_project_status(project_id, "FAILED", 0)
    finally:
        # Clean up temporary prediction GeoTIFF
        if prediction_filepath and os.path.exists(prediction_filepath):
            try:
                os.remove(prediction_filepath)
            except Exception as e:
                logger.warning(f"Worker: Failed to clean up prediction file {prediction_filepath}: {e}")


@router.post("/{project_id}/process", response_model=schemas.ProcessingStartResponse)
def start_processing(
    project_id: str, 
    background_tasks: BackgroundTasks
):
    """Trigger the building footprint extraction pipeline for a survey project."""
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
        
    if project["status"] in ["PREPROCESSING", "TILING", "AI_INFERENCE", "VECTORIZATION"]:
        return {
            "project_id": project_id,
            "status": project["status"],
            "message": "Processing pipeline is already running."
        }

    # Initialize status to PREPROCESSING and reset stats
    project_service.update_project_status(project_id, "PREPROCESSING", 0, tiles_processed=0, total_tiles=0)
    
    # Enqueue background task
    background_tasks.add_task(execute_pipeline, project_id)
    
    return {
        "project_id": project_id,
        "status": "PREPROCESSING",
        "message": "Processing pipeline initiated successfully."
    }


@router.get("/{project_id}/status", response_model=schemas.ProcessingStatusResponse)
def get_processing_status(project_id: str):
    """Retrieve the current stage, progress percentage, tile statistics, and log lines of a project."""
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    # Read logs for the project from file storage
    logs = get_project_logs(project_id)

    return {
        "status": project["status"],
        "progress": project["progress"],
        "tiles_processed": project["tiles_processed"],
        "total_tiles": project["total_tiles"],
        "message": f"Stage: {project['status']} ({project['progress']}%)",
        "logs": logs
    }
