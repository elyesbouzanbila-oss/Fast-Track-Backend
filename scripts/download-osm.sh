#!/bin/bash
# download-osm.sh
# Downloads OSM data for your region from Geofabrik.
# Edit the REGION variable to your target area.
# Full region list: https://download.geofabrik.de/

set -e

REGION="${REGION:-africa/tunisia}"       # Change to your region
OUTPUT_DIR="./osrm-data"
PBF_FILE="${OUTPUT_DIR}/map.osm.pbf"

mkdir -p "$OUTPUT_DIR"

echo "🌍 Downloading OSM data for: $REGION"
echo "   Output: $PBF_FILE"

wget -O "$PBF_FILE" \
  "https://download.geofabrik.de/${REGION}-latest.osm.pbf" \
  --progress=bar

echo ""
echo "✅ Download complete: $PBF_FILE"
echo "   File size: $(du -sh "$PBF_FILE" | cut -f1)"
echo ""
echo "Next step: run  bash scripts/setup-osrm.sh"
