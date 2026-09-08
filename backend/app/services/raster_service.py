import os
import rasterio
from typing import Dict, Any
from app.core.logging import logger


def get_raster_metadata(filepath: str) -> Dict[str, Any]:
    """
    Open the image with rasterio and extract spatial metadata.
    Supports GeoTIFF, PNG, JPEG, etc.
    """
    from app.services.storage_service import storage_service
    from app.core.config import settings
    filepath = storage_service.ensure_local_file(filepath, settings.UPLOADS_DIR)
    
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Image file not found at: {filepath}")

    try:
        with rasterio.open(filepath) as src:
            # Resolve CRS to EPSG string or standard representation
            crs_str = None
            if src.crs:
                epsg_code = src.crs.to_epsg()
                if epsg_code:
                    crs_str = f"EPSG:{epsg_code}"
                else:
                    crs_str = src.crs.to_string()
            else:
                # Default fallback for images without CRS (like jpeg/png)
                crs_str = "EPSG:3857"  # Web Mercator
                logger.warning(
                    f"No Coordinate Reference System (CRS) found in {filepath}. "
                    f"Falling back to default projection: {crs_str}"
                )

            bounds = [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top]
            if src.crs:
                try:
                    epsg_code = src.crs.to_epsg()
                    if epsg_code != 4326:
                        from pyproj import Transformer
                        transformer = Transformer.from_crs(src.crs, "EPSG:4326", always_xy=True)
                        p1 = transformer.transform(src.bounds.left, src.bounds.bottom) # BL
                        p2 = transformer.transform(src.bounds.right, src.bounds.bottom) # BR
                        p3 = transformer.transform(src.bounds.right, src.bounds.top) # TR
                        p4 = transformer.transform(src.bounds.left, src.bounds.top) # TL
                        
                        # Return exactly 8 coordinates for perfect MapLibre warping instead of min/max rect
                        # Order: [TL_lon, TL_lat, TR_lon, TR_lat, BR_lon, BR_lat, BL_lon, BL_lat]
                        bounds = [p4[0], p4[1], p3[0], p3[1], p2[0], p2[1], p1[0], p1[1]]
                except Exception as trans_err:
                    logger.error(f"Error transforming raster bounds to EPSG:4326: {trans_err}")

            resolution = [src.res[0], src.res[1]]

            return {
                "crs": crs_str,
                "width": src.width,
                "height": src.height,
                "resolution": resolution,
                "bounds": bounds,
                "bands": src.count,
                "transform": list(src.transform)
            }
    except Exception as e:
        logger.error(f"Error reading raster metadata from {filepath}: {e}")
        # Return fallback metadata for non-geospatial image files
        from PIL import Image
        try:
            with Image.open(filepath) as img:
                width, height = img.size
                return {
                    "crs": "EPSG:3857",
                    "width": width,
                    "height": height,
                    "resolution": [1.0, 1.0],
                    "bounds": [0.0, 0.0, float(width), float(height)],
                    "bands": len(img.getbands()),
                    "transform": [1.0, 0.0, 0.0, 0.0, -1.0, float(height)]
                }
        except Exception as pil_err:
            logger.error(f"PIL fallback failed for {filepath}: {pil_err}")
            raise ValueError(f"File is not a valid image or orthomosaic: {e}")
