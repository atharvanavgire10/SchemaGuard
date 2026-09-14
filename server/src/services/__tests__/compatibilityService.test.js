'use strict';
const { analyze } = require('../compatibilityService');

const baseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string' },
    avatar: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['active', 'inactive'] }
  }
};

describe('Compatibility Engine - BREAKING changes', () => {
  test('BREAKING: field removed (email)', () => {
    const after = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        avatar: { type: ['string', 'null'] },
        status: { type: 'string', enum: ['active', 'inactive'] }
      }
    };
    const result = analyze(baseSchema, after);
    expect(result.classification).toBe('BREAKING');
    const emailChange = result.changes.find(c => c.path.includes('email'));
    expect(emailChange).toBeDefined();
    expect(emailChange.change).toBe('FIELD_REMOVED');
    expect(result.score).toBeLessThan(100);
  });

  test('BREAKING: type changed (id integer to string)', () => {
    const after = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        avatar: { type: ['string', 'null'] },
        status: { type: 'string', enum: ['active', 'inactive'] }
      }
    };
    const result = analyze(baseSchema, after);
    expect(result.classification).toBe('BREAKING');
    const idChange = result.changes.find(c => c.path.includes('id') && c.change === 'TYPE_CHANGED');
    expect(idChange).toBeDefined();
  });

  test('BREAKING: enum value removed', () => {
    const after = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        email: { type: 'string' },
        avatar: { type: ['string', 'null'] },
        status: { type: 'string', enum: ['active'] } // removed 'inactive'
      }
    };
    const result = analyze(baseSchema, after);
    expect(result.classification).toBe('BREAKING');
    const enumChange = result.changes.find(c => c.change === 'ENUM_VALUE_REMOVED');
    expect(enumChange).toBeDefined();
    expect(enumChange.before).toBe('inactive');
  });

  test('BREAKING: nullable field made non-nullable', () => {
    const after = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        email: { type: 'string' },
        avatar: { type: 'string' }, // was ['string', 'null']
        status: { type: 'string', enum: ['active', 'inactive'] }
      }
    };
    const result = analyze(baseSchema, after);
    expect(result.classification).toBe('BREAKING');
    const nullChange = result.changes.find(c => c.change === 'NULLABLE_REMOVED');
    expect(nullChange).toBeDefined();
  });

  test('BREAKING: nested field removed', () => {
    const before = {
      type: 'object',
      properties: {
        customer: {
          type: 'object',
          properties: {
            address: {
              type: 'object',
              properties: {
                zipCode: { type: 'string' }
              }
            }
          }
        }
      }
    };
    const after = {
      type: 'object',
      properties: {
        customer: {
          type: 'object',
          properties: {
            address: {
              type: 'object',
              properties: {}
            }
          }
        }
      }
    };
    const result = analyze(before, after);
    expect(result.classification).toBe('BREAKING');
    const removedChange = result.changes.find(c => c.change === 'FIELD_REMOVED');
    expect(removedChange).toBeDefined();
    expect(removedChange.path).toContain('zipCode');
  });
});

describe('Compatibility Engine - RISKY changes', () => {
  test('RISKY: enum value added', () => {
    const after = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        email: { type: 'string' },
        avatar: { type: ['string', 'null'] },
        status: { type: 'string', enum: ['active', 'inactive', 'suspended'] }
      }
    };
    const result = analyze(baseSchema, after);
    expect(result.classification).toBe('RISKY');
    const enumChange = result.changes.find(c => c.change === 'ENUM_VALUE_ADDED');
    expect(enumChange).toBeDefined();
    expect(enumChange.after).toBe('suspended');
  });
});

describe('Compatibility Engine - SAFE changes', () => {
  test('SAFE: optional field added (avatar url)', () => {
    const after = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        email: { type: 'string' },
        avatar: { type: ['string', 'null'] },
        status: { type: 'string', enum: ['active', 'inactive'] },
        avatarUrl: { type: ['string', 'null'] }
      }
    };
    const result = analyze(baseSchema, after);
    expect(result.classification).toBe('SAFE');
    expect(result.score).toBe(100);
  });

  test('SAFE: no changes', () => {
    const result = analyze(baseSchema, baseSchema);
    expect(result.classification).toBe('SAFE');
    expect(result.score).toBe(100);
    expect(result.summary.breaking).toBe(0);
    expect(result.summary.risky).toBe(0);
  });

  test('SAFE: nullable field added', () => {
    const after = {
      type: 'object',
      properties: {
        ...baseSchema.properties,
        metadata: { type: ['object', 'null'] }
      }
    };
    const result = analyze(baseSchema, after);
    expect(result.classification).toBe('SAFE');
  });
});

describe('Scoring algorithm', () => {
  test('score is 100 for no changes', () => {
    const result = analyze(baseSchema, baseSchema);
    expect(result.score).toBe(100);
  });

  test('score decreases by 25 per breaking change', () => {
    const after = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' }
        // removed email and avatar (2 breaking)
      }
    };
    const result = analyze(baseSchema, after);
    expect(result.summary.breaking).toBeGreaterThanOrEqual(2);
    expect(result.score).toBeLessThanOrEqual(50); // 100 - 2*25 = 50
  });

  test('score never goes below 0', () => {
    const after = { type: 'object', properties: {} };
    const result = analyze(baseSchema, after);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
