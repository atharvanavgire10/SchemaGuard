'use strict';

/**
 * SchemaGuard Schema Inference Service
 *
 * Infers a normalized JSON schema from one or more JSON observations.
 * Output format is a subset of JSON Schema (draft-07 inspired).
 *
 * Supported types: string, integer, number, boolean, null, object, array
 * Special: nullable fields, enum value tracking, nested objects, arrays of objects
 *
 * SCORING ALGORITHM (compatibility score, documented here):
 * Score starts at 100.
 * Each BREAKING change deducts 25 points (min 0).
 * Each RISKY change deducts 5 points.
 * SAFE changes do not deduct.
 * Final score = max(0, 100 - (breaking * 25) - (risky * 5))
 */

/**
 * Infer the JSON Schema type of a single value.
 * @param {*} value
 * @returns {string} type string
 */
function inferType(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'string'; // fallback
}

/**
 * Infer schema from a single JSON value (recursive).
 * @param {*} value
 * @returns {object} schema node
 */
function inferSchema(value) {
  const type = inferType(value);

  if (type === 'object') {
    const properties = {};
    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferSchema(val);
    }
    return { type: 'object', properties };
  }

  if (type === 'array') {
    if (value.length === 0) {
      return { type: 'array', items: {} };
    }
    // Merge schemas of all array items
    let merged = inferSchema(value[0]);
    for (let i = 1; i < value.length; i++) {
      merged = mergeSchemas(merged, inferSchema(value[i]));
    }
    return { type: 'array', items: merged };
  }

  // Primitive
  const schema = { type };

  // Track observed enum values for strings
  if (type === 'string') {
    schema.enum = [value];
  }

  return schema;
}

/**
 * Merge two schema nodes produced by inferSchema.
 * This handles nullable, type conflicts, enum merging, etc.
 */
function mergeSchemas(a, b) {
  if (!a) return b;
  if (!b) return a;

  const typesA = Array.isArray(a.type) ? a.type : [a.type];
  const typesB = Array.isArray(b.type) ? b.type : [b.type];

  // Combine types
  const combined = [...new Set([...typesA, ...typesB])];

  // Both are objects -> merge properties recursively
  if (typesA.includes('object') && typesB.includes('object')) {
    const allKeys = new Set([
      ...Object.keys(a.properties || {}),
      ...Object.keys(b.properties || {})
    ]);
    const mergedProps = {};
    for (const key of allKeys) {
      if (a.properties?.[key] && b.properties?.[key]) {
        mergedProps[key] = mergeSchemas(a.properties[key], b.properties[key]);
      } else {
        // Field only in one observation - mark as optional/nullable
        const existing = a.properties?.[key] || b.properties?.[key];
        mergedProps[key] = addNullable(existing);
      }
    }
    const result = { type: combined.length === 1 ? combined[0] : combined, properties: mergedProps };
    return result;
  }

  // Both are arrays -> merge items
  if (typesA.includes('array') && typesB.includes('array')) {
    return {
      type: 'array',
      items: mergeSchemas(a.items, b.items)
    };
  }

  // Merge enums for strings
  const result = { type: combined.length === 1 ? combined[0] : combined };
  if (a.enum || b.enum) {
    result.enum = [...new Set([...(a.enum || []), ...(b.enum || [])])];
  }

  return result;
}

/**
 * Make a schema node nullable (add null to type).
 */
function addNullable(schema) {
  if (!schema) return { type: 'null' };
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes('null')) return schema;
  return { ...schema, type: [...types, 'null'] };
}

/**
 * Infer schema from multiple observations by merging them.
 * @param {Array} observations - array of JSON objects
 * @returns {object} merged schema
 */
function inferFromMultiple(observations) {
  if (!observations || observations.length === 0) {
    throw new Error('At least one observation is required');
  }
  let schema = inferSchema(observations[0]);
  for (let i = 1; i < observations.length; i++) {
    schema = mergeSchemas(schema, inferSchema(observations[i]));
  }
  return schema;
}

module.exports = { inferSchema, inferFromMultiple, mergeSchemas, inferType };
