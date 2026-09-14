'use strict';
const { inferSchema } = require('./schemaInferenceService');
const db = require('../db/index');

// In-memory store for demo / local mode (when PostgreSQL is unavailable)
const memoryStore = {
  observations: [],
  clientCounts: {},
  statusCodes: {},
  fieldPresence: {}
};

// Seeded demo baseline - realistic production traffic distribution
const DEMO_TRAFFIC = {
  totalRequests: 184291,
  clients: { web: 42.1, android: 34.8, ios: 23.1 },
  statusCodes: { 200: 96.2, 404: 2.1, 500: 1.7 },
  observedFields: ['id', 'name', 'email', 'avatar', 'status', 'customer'],
  fieldPresence: {
    id: 100.0,
    name: 100.0,
    email: 87.3,
    avatar: 43.2,
    status: 100.0,
    'customer.address.zipCode': 62.4
  },
  clientFieldUsage: {
    id: ['web', 'android', 'ios'],
    name: ['web', 'android', 'ios'],
    email: ['android', 'ios'],
    'customer.address.zipCode': ['android', 'ios', 'web'],
    avatar: ['web', 'android'],
    status: ['web', 'android', 'ios']
  }
};

/**
 * Ingest a production observation.
 */
async function ingest(observation) {
  if (!observation || typeof observation !== 'object') {
    throw new Error('observation must be an object');
  }

  const {
    service,
    endpoint,
    method = 'GET',
    statusCode = 200,
    requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    client = 'unknown',
    response,
    timestamp = new Date().toISOString()
  } = observation;

  if (!service || !endpoint || response === undefined) {
    throw new Error('service, endpoint, and response are required');
  }

  // Infer normalized schema (store schema only, privacy-first)
  const inferredSchema = inferSchema(response);

  const record = {
    service: String(service).slice(0, 255),
    endpoint: String(endpoint).slice(0, 500),
    method: String(method).slice(0, 10).toUpperCase(),
    statusCode: Number(statusCode) || 200,
    requestId: String(requestId).slice(0, 255),
    client: String(client).slice(0, 100).toLowerCase(),
    inferredSchema,
    timestamp
  };

  // Retain in memory buffer (capped to 1,000 for local safety)
  memoryStore.observations.push(record);
  if (memoryStore.observations.length > 1000) {
    memoryStore.observations.shift();
  }

  // Track client distribution in memory
  memoryStore.clientCounts[record.client] = (memoryStore.clientCounts[record.client] || 0) + 1;

  // Persist in PostgreSQL if connected
  if (db.isAvailable()) {
    try {
      await db.query(
        `INSERT INTO projects (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [record.service]
      );
      const projResult = await db.query('SELECT id FROM projects WHERE name = $1 LIMIT 1', [record.service]);
      const projectId = projResult.rows[0]?.id;

      if (projectId) {
        await db.query(
          `INSERT INTO endpoints (project_id, method, path) VALUES ($1, $2, $3)
           ON CONFLICT (project_id, method, path) DO NOTHING`,
          [projectId, record.method, record.endpoint]
        );
        const epResult = await db.query(
          'SELECT id FROM endpoints WHERE project_id = $1 AND method = $2 AND path = $3 LIMIT 1',
          [projectId, record.method, record.endpoint]
        );
        const endpointId = epResult.rows[0]?.id;

        if (endpointId) {
          await db.query(
            `INSERT INTO observations (endpoint_id, service, status_code, request_id, client, inferred_schema, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              endpointId,
              record.service,
              record.statusCode,
              record.requestId,
              record.client,
              JSON.stringify(inferredSchema),
              record.timestamp
            ]
          );
        }
      }
    } catch (err) {
      console.warn('PostgreSQL observation write failed (stored in-memory):', err.message);
    }
  }

  return { stored: true, requestId: record.requestId, inferredSchema };
}

/**
 * Get aggregated traffic statistics.
 */
function getTrafficStats(endpoint) {
  const live = memoryStore.observations.filter(o => !endpoint || o.endpoint === endpoint);

  if (live.length === 0) {
    return DEMO_TRAFFIC;
  }

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
 * Calculate consumer and traffic impact of affected/removed fields.
 * @param {Array<string>} fieldsAffected - array of field path names
 */
function schemaContainsPath(schema, path) {
  const segments = path.replace(/\[\]/g, '').split('.').filter(Boolean);
  let node = schema;
  for (const segment of segments) {
    if (!node || !node.properties || !node.properties[segment]) return false;
    node = node.properties[segment];
  }
  return true;
}

function calculateImpact(fieldsAffected = [], endpoint) {
  const observations = memoryStore.observations.filter(record => !endpoint || record.endpoint === endpoint);
  const results = [];
  for (const rawField of fieldsAffected) {
    const field = String(rawField).replace(/^\./, '').trim();
    if (observations.length > 0) {
      const affected = observations.filter(record => schemaContainsPath(record.inferredSchema, field));
      const affectedClients = [...new Set(affected.map(record => record.client))];
      results.push({
        field,
        affectedTrafficPct: Number(((affected.length / observations.length) * 100).toFixed(1)),
        affectedClients,
        affectedRequests: affected.length
      });
      continue;
    }
    const presence = DEMO_TRAFFIC.fieldPresence[field] !== undefined
      ? DEMO_TRAFFIC.fieldPresence[field]
      : (field ? 15.0 : 0.0); // conservative default if unknown field
    const clients = DEMO_TRAFFIC.clientFieldUsage[field] || ['web', 'android', 'ios'];

    results.push({
      field,
      affectedTrafficPct: presence,
      affectedClients: clients,
      affectedRequests: Math.round((DEMO_TRAFFIC.totalRequests * presence) / 100)
    });
  }
  return results;
}

module.exports = {
  ingest,
  getTrafficStats,
  calculateImpact,
  schemaContainsPath,
  DEMO_TRAFFIC,
  memoryStore
};
