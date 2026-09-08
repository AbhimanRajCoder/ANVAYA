import os
import shutil
import tempfile
import uuid
import geopandas as gpd
from shapely.geometry import shape
import shapely.wkt
from app.core.config import settings
from app.core.logging import logger

def generate_export(project_id: str, export_format: str, buildings: list) -> str:
    """
    Generate building footprint exports in standard formats: GeoJSON, ESRI Shapefile, or GeoPackage.
    Filters out rejected building footprints (review_status == 'REJECTED') to export only validated features.
    
    Args:
        project_id: UUID of the project.
        export_format: One of 'geojson', 'shp', 'gpkg'.
        buildings: A list of building dictionaries containing geometry, area, confidence, etc.
        
    Returns:
        str: Absolute file path of the generated file (or zipped file for Shapefile).
    """
    logger.info(f"Generating export for project {project_id} in format: {export_format}")
    
    # 1. Filter out rejected features
    validated_buildings = [b for b in buildings if b.get("properties", {}).get("review_status") != "rejected"]
    
    if not validated_buildings:
        raise ValueError("No validated buildings exist to export for this project.")
        
    # 2. Extract geometries and attributes for GeoPandas GeoDataFrame
    features_data = []
    for b in validated_buildings:
        geom = b.get("geometry")
        if not geom:
            continue
            
        # Parse geometry to shapely object
        try:
            if isinstance(geom, str):
                shapely_geom = shapely.wkt.loads(geom)
            elif isinstance(geom, dict):
                shapely_geom = shape(geom)
            else:
                # Assume shapely object
                shapely_geom = geom
        except Exception as e:
            logger.error(f"Failed to parse geometry for export: {e}")
            continue
            
        props = b.get("properties", {})
        
        # Shapefiles restrict column names to 10 characters.
        # We define shorter, clean attribute keys for ESRI Shapefile / GPKG consistency.
        features_data.append({
            "building_i": str(props.get("building_id", "")),
            "area": float(props.get("area", 0.0)),
            "confidence": float(props.get("confidence", 0.0)),
            "rev_status": str(props.get("review_status", "AI_DETECTED")),
            "geometry": shapely_geom
        })
        
    if not features_data:
        raise ValueError("No valid shapes found to generate the export dataset.")
        
    # 3. Build GeoDataFrame (WGS84 EPSG:4326 is standard for ANAVYA PostGIS data)
    gdf = gpd.GeoDataFrame(features_data, crs="EPSG:4326")
    
    # Define filenames
    export_id = str(uuid.uuid4())
    os.makedirs(settings.EXPORTS_DIR, exist_ok=True)
    
    if export_format == "geojson":
        # GeoJSON is generated and downloaded browser-side or backend-side.
        # Backend-side generation:
        output_filepath = os.path.join(settings.EXPORTS_DIR, f"{project_id}_{export_id}.geojson")
        gdf.to_file(output_filepath, driver="GeoJSON")
        return output_filepath
        
    elif export_format == "gpkg":
        output_filepath = os.path.join(settings.EXPORTS_DIR, f"{project_id}_{export_id}.gpkg")
        gdf.to_file(output_filepath, driver="GPKG")
        return output_filepath
        
    elif export_format == "shp":
        # Shapefiles are zips of multiple files. We write to a temporary folder and zip it.
        temp_dir = os.path.join(settings.EXPORTS_DIR, f"{project_id}_{export_id}_shp")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Write ESRI Shapefile files inside the temp folder
        shapefile_path = os.path.join(temp_dir, "buildings.shp")
        gdf.to_file(shapefile_path, driver="ESRI Shapefile")
        
        # Zip the directory
        zip_base = os.path.join(settings.EXPORTS_DIR, f"{project_id}_{export_id}")
        zip_archive_path = shutil.make_archive(
            base_name=zip_base,
            format="zip",
            root_dir=temp_dir
        )
        
        # Clean up the unzipped temporary folder
        try:
            shutil.rmtree(temp_dir)
        except Exception as err:
            logger.warning(f"Failed to remove unzipped shapefile directory {temp_dir}: {err}")
            
        return zip_archive_path
        
    else:
        raise ValueError(f"Unsupported export format: {export_format}")
