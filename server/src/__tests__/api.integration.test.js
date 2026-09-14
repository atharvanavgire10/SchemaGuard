'use strict';
const request = require('supertest');

const app = require('../index');

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

  test('rejects schemas without a type', async () => {
    const res = await request(app).post('/api/compatibility/analyze').send({ before: {}, after: {} });
    expect(res.status).toBe(400);
  });
});

describe('observation and GitHub validation', () => {
  test('stores an observation without retaining its response payload', async () => {
    const res = await request(app).post('/api/observe').send({
      service: 'test-service', endpoint: '/users/1', client: 'web', response: { id: 1, email: 'a@example.com' }
    });
    expect(res.status).toBe(201);
    expect(res.body.stored).toBe(true);
    expect(res.body.inferredSchema.properties.email.type).toBe('string');
  });

  test('rejects unsafe GitHub repository identifiers before network access', async () => {
    const res = await request(app).post('/api/github/analyze-pr').send({
      owner: '../internal', repo: 'repo', prNumber: 1,
      before: { type: 'object', properties: {} }, after: { type: 'object', properties: {} }
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REPOSITORY');
  });

  test('calculates impact from observed endpoint traffic', async () => {
    await request(app).post('/api/observe').send({ service: 'impact-service', endpoint: '/orders/1', client: 'ios', response: { id: 1, total: 10 } });
    await request(app).post('/api/observe').send({ service: 'impact-service', endpoint: '/orders/1', client: 'web', response: { id: 2 } });
    const res = await request(app).post('/api/observe/analyze').send({
      endpoint: '/orders/1',
      before: { type: 'object', properties: { total: { type: 'integer' } } },
      after: { type: 'object', properties: {} }
    });
    expect(res.status).toBe(200);
    expect(res.body.impact.fieldImpacts[0]).toMatchObject({ field: 'total', affectedTrafficPct: 50, affectedClients: ['ios'] });
  });
});

