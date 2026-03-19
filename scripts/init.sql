-- init.sql
-- Runs automatically when the PostGIS Docker container first starts.
-- Enables required extensions.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Grant permissions to the app user
GRANT ALL PRIVILEGES ON DATABASE navdb TO navuser;
