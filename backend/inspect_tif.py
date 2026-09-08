import rasterio
filepath = "storage/uploads/test_62533e4f-589a-49d6-aa08-87e454017469.tif"
try:
    with rasterio.open(filepath) as src:
        print(f"CRS: {src.crs}")
        print(f"Bounds: {src.bounds}")
        print(f"Transform: {src.transform}")
        print(f"Shape: {src.width}x{src.height}")
except Exception as e:
    print(f"Error: {e}")
