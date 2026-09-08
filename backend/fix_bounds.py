import os
import json
from app.database import supabase
from app.services.raster_service import get_raster_metadata

def fix_all_project_bounds():
    print("Fetching projects...")
    res = supabase.table("projects").select("id, source_file, bounds").execute()
    for row in res.data:
        pid = row["id"]
        source_file = row["source_file"]
        old_bounds = row.get("bounds", [])
        
        if len(old_bounds) == 8:
            print(f"Project {pid} already has 8 coordinates. Skipping.")
            continue
            
        print(f"Processing project {pid}...")
        if os.path.exists(source_file):
            try:
                meta = get_raster_metadata(source_file)
                new_bounds = meta["bounds"]
                if len(new_bounds) == 8:
                    supabase.table("projects").update({"bounds": new_bounds}).eq("id", pid).execute()
                    print(f"  -> Updated {pid} bounds to 8 coordinates.")
                else:
                    print(f"  -> {pid} meta bounds still not 8.")
            except Exception as e:
                print(f"  -> Failed to read raster: {e}")
        else:
            print(f"  -> Source file not found: {source_file}")

if __name__ == "__main__":
    fix_all_project_bounds()
