from pyproj import Transformer

transformer = Transformer.from_crs("EPSG:32611", "EPSG:4326", always_xy=True)

tl = transformer.transform(691902.30, 5669064.92)
tr = transformer.transform(692162.41, 5669064.92)
br = transformer.transform(692162.41, 5668796.76)
bl = transformer.transform(691902.30, 5668796.76)

print(f"Top-Left: {tl}")
print(f"Top-Right: {tr}")
print(f"Bottom-Right: {br}")
print(f"Bottom-Left: {bl}")
