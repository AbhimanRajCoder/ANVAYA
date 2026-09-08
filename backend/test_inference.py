import rasterio
import numpy as np
filepath = "storage/uploads/test_62533e4f-589a-49d6-aa08-87e454017469.tif"
with rasterio.open(filepath) as src:
    print("Transform:", src.transform)
