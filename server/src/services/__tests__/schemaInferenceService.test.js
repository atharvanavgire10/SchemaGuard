'use strict';
const { inferSchema, inferFromMultiple, mergeSchemas } = require('../schemaInferenceService');

describe('inferSchema', () => {
  test('infers integer', () => {
    expect(inferSchema(42)).toEqual({ type: 'integer' });
    const s = inferSchema(42);
    expect(s.type).toBe('integer');
  });

  test('infers number (float)', () => {
    const s = inferSchema(3.14);
    expect(s.type).toBe('number');
  });

  test('infers string', () => {
    const s = inferSchema('hello');
    expect(s.type).toBe('string');
    expect(s.enum).toEqual(['hello']);
  });

  test('infers boolean', () => {
    expect(inferSchema(true).type).toBe('boolean');
    expect(inferSchema(false).type).toBe('boolean');
  });

  test('infers null', () => {
    expect(inferSchema(null).type).toBe('null');
  });

  test('infers object', () => {
    const s = inferSchema({ id: 1, name: 'Alice' });
    expect(s.type).toBe('object');
    expect(s.properties.id.type).toBe('integer');
    expect(s.properties.name.type).toBe('string');
  });

  test('infers nested objects', () => {
    const s = inferSchema({ address: { city: 'NYC', zip: '10001' } });
    expect(s.properties.address.type).toBe('object');
    expect(s.properties.address.properties.city.type).toBe('string');
  });

  test('infers empty array', () => {
    const s = inferSchema([]);
    expect(s.type).toBe('array');
    expect(s.items).toEqual({});
  });

  test('infers array of integers', () => {
    const s = inferSchema([1, 2, 3]);
    expect(s.type).toBe('array');
    expect(s.items.type).toBe('integer');
  });

  test('infers array of objects', () => {
    const s = inferSchema([{ id: 1 }, { id: 2 }]);
    expect(s.type).toBe('array');
    expect(s.items.type).toBe('object');
    expect(s.items.properties.id.type).toBe('integer');
  });

  test('infers full user object', () => {
    const s = inferSchema({
      id: 123,
      name: 'Atharva',
      email: 'atharva@example.com',
      active: true,
      avatar: null
    });
    expect(s.type).toBe('object');
    expect(s.properties.id.type).toBe('integer');
    expect(s.properties.name.type).toBe('string');
    expect(s.properties.active.type).toBe('boolean');
    expect(s.properties.avatar.type).toBe('null');
  });
});

describe('inferFromMultiple', () => {
  test('throws on empty array', () => {
    expect(() => inferFromMultiple([])).toThrow();
  });

  test('merges two objects with same fields', () => {
    const s = inferFromMultiple([
      { id: 1, status: 'active' },
      { id: 2, status: 'inactive' }
    ]);
    expect(s.type).toBe('object');
    expect(s.properties.id.type).toBe('integer');
    expect(s.properties.status.type).toBe('string');
    expect(s.properties.status.enum).toContain('active');
    expect(s.properties.status.enum).toContain('inactive');
  });

  test('marks field optional when missing in some observations without inventing null', () => {
    const s = inferFromMultiple([
      { id: 1, email: 'a@b.com' },
      { id: 2 }
    ]);
    expect(s.properties.email.type).toBe('string');
    expect(s.required).toEqual(['id']);
  });

  test('handles conflicting types', () => {
    const s = inferFromMultiple([
      { id: 1 },
      { id: 'abc' }
    ]);
    const idTypes = Array.isArray(s.properties.id.type)
      ? s.properties.id.type
      : [s.properties.id.type];
    expect(idTypes).toContain('integer');
    expect(idTypes).toContain('string');
  });

  test('enum discovery across observations', () => {
    const s = inferFromMultiple([
      { role: 'admin' },
      { role: 'user' },
      { role: 'guest' }
    ]);
    expect(s.properties.role.enum).toEqual(expect.arrayContaining(['admin', 'user', 'guest']));
  });
});
