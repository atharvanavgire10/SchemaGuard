'use strict';
const { inferSchema } = require('./schemaInferenceService');
const db = require('../db/index');

// In-memory store for demo mode (when DB is unavailable)
const memoryStore = {
  observations: [],
  clientCounts: {},
  statusCodes: {},
  fieldPresence: {}
};

// Seeded demo data - realistic production traffic
const DEMO_TRAFFIC = {
  totalRequests: 184291,
  clients: { web: 42.1, android: 34.8, ios: 23.1 },
  statusCodes: { 200: 96.2, 404: 2.1, 500: 1.7 },
  observedFields: ['id', 'name', 'email', 'avatar', 'status', 'customer'],
  // Field-level presence percentages (what % of responses include this field)
  fieldPresence: {
    id: 100.0,
    name: 100.0,
    email: 87.3,   // ~161k requests read email
    avatar: 43.2,  // not all users have avatar
    status: 100.0,
    'customer.address.zipCode': 62.4
  },
  clientFieldUsage: {
    // Which clients access which fields
    email: ['android', 'ios'],
    'customer.address.zipCode': ['android', 'ios', 'web'],
    avatar: ['web', 'android']
  }
};

/**
 * Ingest a production observation.
 */
async function ingest(observation) {
  const {
    service,
    endpoint,
    method = 'GET',
    statusCode = 200,
    requestId,
    client = 'unknown',
    response,
    timestamp = new Date().toISOString()
  } = observation;

  if (!service || !endpoint || !response) {
    throw new Error('service, endpoint, and response are required');
  }

  // Infer schema from the response (store schema, not raw payload)
  const inferredSchema = inferSchema(response);

  const record = {
    service,
    endpoint,
    method,
    statusCode,
    requestId,
    client,
    inferredSchema,
    timestamp
  };

  // Store in memory
  memoryStore.observations.push(record);
  // Keep only last 1000 observations in memory (retention policy)
  if (memoryStore.observations.length > 1000) {
    memoryStore.observations.shift();
  }

  // Track client counts
  memoryStore.clientCounts[client] = (memoryStore.clientCounts[client] || 0) + 1;

  // Store in DB if available
  if (db.isAvailable()) {
    try {
      // Upsert project
      // For MVP, use service name as project identifier
      await db.query(
        `INSERT INTO projects (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [service]
      );
      const projResult = await db.query('SELECT id FROM projects WHERE name = $1', [service]);
      const projectId = projResult.rows[0]?.id;

      if (projectId) {
        // Upsert endpoint
        await db.query(
          `INSERT INTO endpoints (project_id, method, path) VALUES ($1, $2, $3)
           ON CONFLICT (project_id, method, path) DO NOTHING`,
          [projectId, method, endpoint]
        );
        const epResult = await db.query(
          'SELECT id FROM endpoints WHERE project_id = $1 AND method = $2 AND path = $3',
          [projectId, method, endpoint]
        );
        const endpointId = epResult.rows[0]?.id;

        if (endpointId) {
          // Insert observation (schema only, not raw payload)
          await db.query(
            `INSERT INTO observations (endpoint_id, service, status_code, request_id, client, inferred_schema, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [endpointId, service, statusCode, requestId, client,
             JSON.stringify(inferredSchema), timestamp]
          );
        }
      }
    } catch (err) {
      console.warn('DB write failed, observation stored in memory only:', err.message);
    }
  }

  return { stored: true, inferredSchema };
}

/**
 * Get traffic statistics for the demo project.
 * Returns seeded data merged with any live observations.
 */
function getTrafficStats(endpoint) {
  const live = memoryStore.observations.filter(o => !endpoint || o.endpoint === endpoint);

  if (live.length === 0) {
    // Return seeded demo data
    return DEMO_TRAFFIC;
  }

  // Merge seeded + live
  const totalLive = live.length;
  const clientCounts = {};
  for (const obs of live) {
    clientCounts[obs.client] = (clientCounts[obs.client] || 0) + 1;
  }
  const clientPcts = {};
  for (const [c, count] of Object.entries(clientCounts)) {
    clientPcts[c] = parseFloat(((count / totalLive) * 100).toFixed(1));
  }

  return {
    totalRequests: DEMO_TRAFFIC.totalRequests + totalLive,
    clients: Object.keys(clientPcts).length > 0 ? clientPcts : DEMO_TRAFFIC.clients,
    statusCodes: DEMO_TRAFFIC.statusCodes,
    observedFields: DEMO_TRAFFIC.observedFields,
    fieldPresence: DEMO_TRAFFIC.fieldPresence,
    clientFieldUsage: DEMO_TRAFFIC.clientFieldUsage
  };
}

/**
 * Calculate impact of a field removal.
 */
function calculateImpact(fieldsAffected) {
  const results = [];
  for (const field of fieldsAffected) {
    const presence = DEMO_TRAFFIC.fieldPresence[field];
    const clients = DEMO_TRAFFIC.clientFieldUsage[field] || [];
    if (presence !== undefined) {
      results.push({
        field,
        affectedTrafficPct: presence,
        affectedClients: clients,
        affectedRequests: Math.round(DEMO_TRAFFIC.totalRequests * presence / 100)
      });
    }
  }
  return results;
}

module.exports = { ingest, getTrafficStats, calculateImpact, DEMO_TRAFFIC };
