import os
import rasterio
import numpy as np
from typing import Callable, Optional
from app.core.config import settings
from app.core.logging import logger
from app.models.model_registry import model_registry
from app.services.tiling_service import generate_tiles, count_total_tiles


def run_building_inference(
    source_filepath: str,
    project_id: str,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> str:
    """
    Run building footprint inference on a drone orthomosaic.
    Process the image tile-by-tile, run Model 1, and write the predictions 
    incrementally to a single-band GeoTIFF to avoid RAM exhaustion.
    
    Returns:
        str: File path to the generated prediction mask GeoTIFF.
    """
    from app.services.storage_service import storage_service
    from app.core.config import settings
    
    # Ensure local file if it's from R2
    source_filepath = storage_service.ensure_local_file(source_filepath, settings.UPLOADS_DIR)
    
    if not os.path.exists(source_filepath):
        raise FileNotFoundError(f"Source file not found: {source_filepath}")

    logger.info(f"Starting building footprint inference for project {project_id}")

    # Load Model 1 from Registry
    model = model_registry.get_model("model1_building")
    
    # Check if model has loaded its weights, if not load it
    if model.model is None:
        model.load_model(settings.MODEL1_CHECKPOINT)

    # Output prediction file path
    prediction_filename = f"{project_id}_prediction.tif"
    prediction_filepath = os.path.join(settings.PREDICTIONS_DIR, prediction_filename)

    # Read source image metadata
    with rasterio.open(source_filepath) as src:
        profile = src.profile.copy()
        width = src.width
        height = src.height
        crs = src.crs
        transform = src.transform

    # Configure metadata for prediction GeoTIFF
    profile.update(
        driver="GTiff",
        count=1,
        dtype="float32",
        height=height,
        width=width,
        crs=crs,
        transform=transform,
        nodata=0.0
    )

    total_tiles = count_total_tiles(source_filepath, settings.TILE_SIZE, settings.OVERLAP)
    logger.info(f"Total tiles to process: {total_tiles} (Size: {settings.TILE_SIZE}, Overlap: {settings.OVERLAP})")

    # Create the prediction file and write tile predictions incrementally
    tiles_processed = 0
    BATCH_SIZE = 4
    
    with rasterio.open(prediction_filepath, "w", **profile) as dst:
        tile_generator = generate_tiles(source_filepath, settings.TILE_SIZE, settings.OVERLAP)
        
        import torch
        batch_windows = []
        batch_tensors = []
        
        for window, tile in tile_generator:
            # 1. Preprocess tile to model tensor
            tensor = model.preprocess(tile)
            batch_windows.append(window)
            batch_tensors.append(tensor)
            
            if len(batch_tensors) >= BATCH_SIZE:
                # 2. Run batched model inference
                batch_tensor = torch.cat(batch_tensors, dim=0)
                prob_maps = model.predict(batch_tensor)  # returns shape (N, 512, 512)
                
                # 3. Write predictions back
                for i in range(len(batch_windows)):
                    w = batch_windows[i]
                    prob_map = prob_maps[i]
                    
                    w_width = w.width
                    w_height = w.height
                    valid_prediction = prob_map[:w_height, :w_width]
                    dst.write(valid_prediction.astype(np.float32), 1, window=w)
                
                # 4. Track progress
                tiles_processed += len(batch_windows)
                if progress_callback:
                    progress_callback(tiles_processed, total_tiles)
                    
                batch_windows = []
                batch_tensors = []

        # Process any remaining tiles in the last batch
        if len(batch_tensors) > 0:
            batch_tensor = torch.cat(batch_tensors, dim=0)
            prob_maps = model.predict(batch_tensor)
            
            for i in range(len(batch_windows)):
                w = batch_windows[i]
                prob_map = prob_maps[i]
                
                w_width = w.width
                w_height = w.height
                valid_prediction = prob_map[:w_height, :w_width]
                dst.write(valid_prediction.astype(np.float32), 1, window=w)
            
            tiles_processed += len(batch_windows)
            if progress_callback:
                progress_callback(tiles_processed, total_tiles)

    logger.info(f"Building footprint inference completed. Saved mask to: {prediction_filepath}")
    return prediction_filepath
