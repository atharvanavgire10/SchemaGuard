-- SchemaGuard PostgreSQL Schema
-- Run: psql -U postgres -d schemaguard -f schema.sql

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS endpoints (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, method, path)
);

CREATE TABLE IF NOT EXISTS observations (
  id SERIAL PRIMARY KEY,
  endpoint_id INTEGER REFERENCES endpoints(id) ON DELETE CASCADE,
  service VARCHAR(255),
  status_code INTEGER,
  request_id VARCHAR(255),
  client VARCHAR(100),
  -- Store only inferred schema, not raw payload (privacy/retention)
  inferred_schema JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  endpoint_id INTEGER REFERENCES endpoints(id) ON DELETE CASCADE,
  schema JSONB NOT NULL,
  observation_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyses (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  endpoint_id INTEGER REFERENCES endpoints(id),
  before_schema JSONB NOT NULL,
  after_schema JSONB NOT NULL,
  result JSONB NOT NULL,
  classification VARCHAR(20) NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_observations_endpoint_id ON observations(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp);
CREATE INDEX IF NOT EXISTS idx_observations_request_id ON observations(request_id);
CREATE INDEX IF NOT EXISTS idx_observations_client ON observations(client);
CREATE INDEX IF NOT EXISTS idx_contracts_endpoint_id ON contracts(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project_id ON analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_project_id ON endpoints(project_id);
