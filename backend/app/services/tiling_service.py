import rasterio
from rasterio.windows import Window
from typing import Generator, Tuple
import numpy as np
from app.core.logging import logger


def generate_tiles(
    filepath: str,
    tile_size: int = 512,
    overlap: int = 32
) -> Generator[Tuple[Window, np.ndarray], None, None]:
    """
    Generator that reads a raster file in windowed chunks of size tile_size x tile_size.
    Handles overlaps and pads edge tiles with zeros to maintain uniform output size.
    
    Yields:
        Tuple[Window, np.ndarray]: The rasterio Window and the padded image tile (H, W, C).
    """
    from app.services.storage_service import storage_service
    from app.core.config import settings
    
    filepath = storage_service.ensure_local_file(filepath, settings.UPLOADS_DIR)
    
    try:
        with rasterio.open(filepath) as src:
            width = src.width
            height = src.height
            
            # Stride calculation based on overlap
            stride = tile_size - overlap
            if stride <= 0:
                raise ValueError("Overlap must be strictly smaller than tile size.")

            for y in range(0, height, stride):
                for x in range(0, width, stride):
                    # Define extraction window, crop to image boundaries
                    w_width = min(tile_size, width - x)
                    w_height = min(tile_size, height - y)
                    
                    window = Window(x, y, w_width, w_height)
                    
                    # Read up to 3 bands (RGB)
                    bands_to_read = min(src.count, 3)
                    data = src.read(list(range(1, bands_to_read + 1)), window=window)
                    
                    # Transform (Bands, H, W) to (H, W, Bands)
                    if data.shape[0] == 1:
                        # Grayscale to RGB
                        img_tile = np.squeeze(data, axis=0)
                        img_tile = np.stack([img_tile, img_tile, img_tile], axis=-1)
                    else:
                        img_tile = np.transpose(data, (1, 2, 0))
                        # If image has 2 bands, pad to 3
                        if img_tile.shape[2] == 2:
                            padding = np.zeros((img_tile.shape[0], img_tile.shape[1], 1), dtype=img_tile.dtype)
                            img_tile = np.concatenate([img_tile, padding], axis=-1)

                    # Handle padding for boundary tiles
                    if w_height < tile_size or w_width < tile_size:
                        padded_tile = np.zeros((tile_size, tile_size, 3), dtype=img_tile.dtype)
                        padded_tile[:w_height, :w_width, :] = img_tile
                        img_tile = padded_tile

                    yield window, img_tile
                    
    except Exception as e:
        logger.error(f"Error in tiling generator for {filepath}: {e}")
        raise e


def count_total_tiles(filepath: str, tile_size: int = 512, overlap: int = 32) -> int:
    """Calculate the total number of tiles that will be generated for progress tracking."""
    from app.services.storage_service import storage_service
    from app.core.config import settings
    filepath = storage_service.ensure_local_file(filepath, settings.UPLOADS_DIR)
    
    with rasterio.open(filepath) as src:
        width = src.width
        height = src.height
        
    stride = tile_size - overlap
    cols = (width + stride - 1) // stride
    rows = (height + stride - 1) // stride
    return cols * rows
