import json
import urllib.request

url = "http://localhost:8000/api/v1/projects/5b0e10c5-674b-4be2-a704-6f5b58ecf371/buildings"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

min_lng = 180
max_lng = -180
min_lat = 90
max_lat = -90

for f in data['features']:
    coords = f['geometry']['coordinates'][0]
    for c in coords:
        if c[0] < min_lng: min_lng = c[0]
        if c[0] > max_lng: max_lng = c[0]
        if c[1] < min_lat: min_lat = c[1]
        if c[1] > max_lat: max_lat = c[1]

print(f"[{min_lng}, {min_lat}, {max_lng}, {max_lat}]")
