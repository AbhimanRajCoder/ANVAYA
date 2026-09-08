import math
import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.mask import mask
from shapely.geometry import shape, mapping
from shapely.ops import transform
from pyproj import Transformer
from typing import List, Dict, Any
from app.core.logging import logger


def get_utm_epsg(lon: float, lat: float) -> int:
    """
    Determine the UTM EPSG code for a given longitude and latitude.
    Used to calculate accurate surface areas in metric space.
    """
    # UTM zone calculation: 1 to 60
    zone = int(math.floor((lon + 180) / 6) + 1)
    # Determine hemisphere
    is_northern = lat >= 0
    # EPSG prefix: 326XX for Northern, 327XX for Southern
    prefix = 32600 if is_northern else 32700
    return prefix + zone


def calculate_polygon_area(geom, src_crs) -> float:
    """
    Calculate area in square meters. Reprojects geographic coordinates 
    to a local UTM zone if the source coordinates are in degrees.
    """
    try:
        if src_crs.is_projected:
            return geom.area
            
        # Geographic coordinates (e.g. EPSG:4326)
        centroid = geom.centroid
        utm_epsg = get_utm_epsg(centroid.x, centroid.y)
        
        # Build transformer
        transformer = Transformer.from_crs(src_crs, f"EPSG:{utm_epsg}", always_xy=True)
        geom_utm = transform(transformer.transform, geom)
        return geom_utm.area
    except Exception as e:
        logger.error(f"Error calculating polygon area: {e}")
        return 0.0


def transform_to_4326(geom, src_crs):
    """Transform geometry coordinates to EPSG:4326 (WGS 84) for GeoJSON export."""
    try:
        if src_crs.to_epsg() == 4326:
            return geom
            
        transformer = Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)
        return transform(transformer.transform, geom)
    except Exception as e:
        logger.error(f"Error transforming geometry to EPSG:4326: {e}")
        return geom


def vectorize_mask(
    prediction_filepath: str,
    threshold: float = 0.5,
    min_area: float = 5.0
) -> List[Dict[str, Any]]:
    """
    Convert the float32 probability mask in prediction_filepath to vectorized polygons.
    Simplifies paths, discards noise below min_area, and extracts mean confidence.
    
    Returns:
        List[Dict[str, Any]]: List of dictionary structures containing geometry (as a shapely Polygon),
                              area, and confidence score.
    """
    logger.info(f"Vectorizing prediction mask: {prediction_filepath} with threshold={threshold}")
    
    results = []
    try:
        with rasterio.open(prediction_filepath) as src:
            mask_data = src.read(1)
            transform_affine = src.transform
            crs = src.crs

            # Apply threshold to create binary mask
            binary_mask = (mask_data >= threshold).astype(np.uint8)

            # Generate polygons from binary mask where pixel value is 1 (building)
            shape_generator = shapes(
                binary_mask, 
                mask=(binary_mask == 1), 
                transform=transform_affine
            )

            for geom_dict, val in shape_generator:
                # Convert GeoJSON dictionary to Shapely Geometry
                shapely_geom = shape(geom_dict)

                # Fix self-intersections or invalid geometries
                if not shapely_geom.is_valid:
                    shapely_geom = shapely_geom.buffer(0)
                    if not shapely_geom.is_valid or shapely_geom.is_empty:
                        continue

                # Calculate accurate area in square meters
                area_m2 = calculate_polygon_area(shapely_geom, crs)
                
                # Filter out tiny noise polygons
                if area_m2 < min_area:
                    continue

                # Simplify geometry slightly to clean up pixels (0.1m tolerance for projected, 0.000001 for geographic)
                tolerance = 0.1 if crs.is_projected else 0.000001
                simplified_geom = shapely_geom.simplify(tolerance, preserve_topology=True)

                # Calculate confidence score (average probability inside the polygon)
                # Using rasterio.mask to crop the probability values inside this specific polygon
                geom_geojson = mapping(shapely_geom)
                cropped_img, _ = mask(src, [geom_geojson], crop=True, nodata=-1.0)
                valid_pixels = cropped_img[0][cropped_img[0] != -1.0]
                
                if len(valid_pixels) > 0:
                    confidence = float(np.mean(valid_pixels))
                else:
                    confidence = threshold  # Fallback

                # Reproject geometry to EPSG:4326 for standard Web-GIS consumption
                geom_4326 = transform_to_4326(simplified_geom, crs)

                results.append({
                    "geometry": geom_4326,
                    "area": float(round(area_m2, 2)),
                    "confidence": float(round(confidence, 4))
                })

        logger.info(f"Vectorization completed. Extracted {len(results)} building footprints.")
        return results

    except Exception as e:
        logger.error(f"Error during vectorization: {e}")
        raise e
