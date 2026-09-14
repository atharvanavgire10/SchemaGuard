'use strict';
const request = require('supertest');

// We need to create a test app that doesn't start listening
const express = require('express');
const cors = require('cors');
const demoRoutes = require('../routes/demoRoutes');
const schemaRoutes = require('../routes/schemaRoutes');
const compatibilityRoutes = require('../routes/compatibilityRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'schemaguard-api' }));
app.use('/api/demo', demoRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/compatibility', compatibilityRoutes);

describe('GET /health', () => {
  test('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/demo', () => {
  test('returns demo data', async () => {
    const res = await request(app).get('/api/demo');
    expect(res.status).toBe(200);
    expect(res.body.api.name).toBe('E-Commerce API');
    expect(res.body.scenarios).toBeInstanceOf(Array);
    expect(res.body.scenarios.length).toBeGreaterThanOrEqual(4);
  });
});

describe('POST /api/demo/analyze', () => {
  test('analyzes remove-email scenario as BREAKING', async () => {
    const res = await request(app).post('/api/demo/analyze').send({ scenarioId: 'remove-email' });
    expect(res.status).toBe(200);
    expect(res.body.classification).toBe('BREAKING');
  });

  test('analyzes add-avatar scenario as SAFE', async () => {
    const res = await request(app).post('/api/demo/analyze').send({ scenarioId: 'add-avatar' });
    expect(res.status).toBe(200);
    expect(res.body.classification).toBe('SAFE');
  });

  test('analyzes add-status-enum scenario as RISKY', async () => {
    const res = await request(app).post('/api/demo/analyze').send({ scenarioId: 'add-status-enum' });
    expect(res.status).toBe(200);
    expect(res.body.classification).toBe('RISKY');
  });

  test('returns 400 for missing scenarioId', async () => {
    const res = await request(app).post('/api/demo/analyze').send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown scenario', async () => {
    const res = await request(app).post('/api/demo/analyze').send({ scenarioId: 'nonexistent' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/schema/infer', () => {
  test('infers schema from data', async () => {
    const res = await request(app).post('/api/schema/infer').send({
      data: { id: 1, name: 'Alice', active: true }
    });
    expect(res.status).toBe(200);
    expect(res.body.schema.type).toBe('object');
    expect(res.body.schema.properties.id.type).toBe('integer');
  });

  test('infers schema from multiple observations', async () => {
    const res = await request(app).post('/api/schema/infer').send({
      observations: [
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' }
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.schema.properties.status.enum).toContain('active');
    expect(res.body.schema.properties.status.enum).toContain('inactive');
  });

  test('returns 400 for missing data', async () => {
    const res = await request(app).post('/api/schema/infer').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/compatibility/analyze', () => {
  test('detects breaking change', async () => {
    const res = await request(app).post('/api/compatibility/analyze').send({
      before: { type: 'object', properties: { email: { type: 'string' } } },
      after: { type: 'object', properties: {} }
    });
    expect(res.status).toBe(200);
    expect(res.body.classification).toBe('BREAKING');
  });

  test('returns 400 for missing schemas', async () => {
    const res = await request(app).post('/api/compatibility/analyze').send({ before: {} });
    expect(res.status).toBe(400);
  });
});
