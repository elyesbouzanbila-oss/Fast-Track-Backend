#!/bin/bash
set -e

DATA_DIR="$(pwd)/osrm-data"
PBF_FILE="$DATA_DIR/map.osm.pbf"
OSRM_IMAGE="osrm/osrm-backend:latest"

if [ ! -f "$PBF_FILE" ]; then
  echo "❌ OSM file not found: $PBF_FILE"
  echo "   Put your .osm.pbf at that path or run scripts/download-osm.sh first."
  exit 1
fi

echo "🚗 Processing car profile (MLD)..."
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-extract -p /opt/car.lua /data/map.osm.pbf
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-partition /data/map.osrm
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-customize /data/map.osrm
echo "   ✅ Car profile ready (map.osrm)"

echo ""
echo "🚶 Processing foot (walking) profile (MLD)..."
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-extract -p /opt/foot.lua /data/map.osm.pbf
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-partition /data/map.osrm
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-customize /data/map.osrm
echo "   ✅ Foot profile ready (same map.osrm)"

echo ""
echo "✅ OSRM setup complete."
echo ""
echo "Start OSRM routing servers with:"
echo "   docker-compose --profile routing up -d"