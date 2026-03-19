# Navigation Backend API

A robust navigation backend built with Node.js, PostgreSQL + PostGIS, and OSRM. Supports car, walking, and public transit (Bus, Train, Metro) routing with hazard awareness.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | PostgreSQL 15 + PostGIS 3.4 |
| Routing Engine | OSRM (Open Source Routing Machine) |
| Transit Data | GTFS (General Transit Feed Specification) |
| Auth | JWT |
| Containerization | Docker + Docker Compose |

---

## Quick Start

### 1. Prerequisites
- Docker & Docker Compose
- Node.js 18+
- OSM data for your region (see scripts/download-osm.sh)

### 2. Setup

```bash
# Clone and enter directory
cp .env.example .env
# Edit .env with your values

# Start PostgreSQL with PostGIS
docker-compose up -d postgres

# Install dependencies
npm install

# Run DB migrations (creates all tables + PostGIS extensions)
npm run db:migrate

# Seed sample hazard data
npm run seed-hazards

# Start dev server
npm run dev
```

### 3. OSRM Setup (Routing Engine)

```bash
# Download OSM data for your region
bash scripts/download-osm.sh

# Pre-process for OSRM (car + foot profiles)
bash scripts/setup-osrm.sh

# Start OSRM containers
docker-compose --profile routing up -d
```

### 4. Import Transit Data (GTFS)

```bash
# Place your GTFS .zip or folder in ./data/gtfs/
npm run import-gtfs
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, get JWT |

### Routing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/route` | Get route (car/walk/transit/multimodal) |
| GET | `/api/route/snap` | Snap coordinate to nearest road |
| GET | `/api/route/transit-stops` | Nearby transit stops |

### Hazards
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hazards` | List hazards (with bbox filter) |
| POST | `/api/hazards` | Report a hazard (auth required) |
| PUT | `/api/hazards/:id` | Update hazard |
| DELETE | `/api/hazards/:id` | Delete hazard (admin) |

---

## Route Request Example

```json
POST /api/route
{
  "origin": { "lat": 36.8065, "lng": 10.1815 },
  "destination": { "lat": 36.8190, "lng": 10.1658 },
  "mode": "transit",
  "options": {
    "avoidHazards": true,
    "maxWalkDistance": 800
  }
}
```

---

## Architecture

```
Request → Auth Middleware → Validation → Controller
                                              ↓
                                     Routing Service
                                    ↙      ↓       ↘
                               OSRM   Transit DB   Hazard Filter
                                    ↘      ↓       ↙
                                     PostGIS Snap
                                          ↓
                                     Response
```

### Snap-to-Road Safety
All coordinates are snapped to the nearest valid road using PostGIS before being sent to OSRM. This prevents routing to water bodies, highways (as pedestrian), or other impossible locations.

---

## Environment Variables

See `.env.example` for full list.

---

## Testing

```bash
npm test               # All tests
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests (requires running DB)
```
