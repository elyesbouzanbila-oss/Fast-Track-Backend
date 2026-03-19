#!/bin/bash
# setup-osrm.sh
# Pre-processes OSM data for OSRM routing (car + foot profiles).
# Uses the MLD (Multi-Level Dijkstra) algorithm for fast, memory-efficient routing.
#
# Prerequisites: Docker must be running.
# Run AFTER download-osm.sh.

set -e

DATA_DIR="$(pwd)/osrm-data"
PBF_FILE="$DATA_DIR/map.osm.pbf"
OSRM_IMAGE="osrm/osrm-backend:latest"

if [ ! -f "$PBF_FILE" ]; then
  echo "❌ OSM file not found: $PBF_FILE"
  echo "   Run scripts/download-osm.sh first."
  exit 1
fi

echo "🚗 Processing car profile..."
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-extract -p /opt/car.lua /data/map.osm.pbf
cp "$DATA_DIR/map.osrm" "$DATA_DIR/map-car.osrm" 2>/dev/null || true
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-partition /data/map-car.osrm
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-customize /data/map-car.osrm
echo "   ✅ Car profile ready"

echo ""
echo "🚶 Processing foot (walking) profile..."
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-extract -p /opt/foot.lua /data/map.osm.pbf
cp "$DATA_DIR/map.osrm" "$DATA_DIR/map-foot.osrm" 2>/dev/null || true
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-partition /data/map-foot.osrm
docker run --rm -v "$DATA_DIR:/data" $OSRM_IMAGE \
  osrm-customize /data/map-foot.osrm
echo "   ✅ Foot profile ready"

echo ""
echo "✅ OSRM setup complete."
echo ""
echo "Start OSRM routing servers with:"
echo "   docker-compose --profile routing up -d"
