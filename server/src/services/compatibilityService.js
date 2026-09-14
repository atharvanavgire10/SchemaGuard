'use strict';

/**
 * SchemaGuard Compatibility Analysis Service
 *
 * Compares an OLD schema (observed production baseline) against a NEW schema
 * and classifies every detected change as SAFE, RISKY, or BREAKING.
 *
 * SCORING ALGORITHM:
 * score = max(0, 100 - (breakingCount * 25) - (riskyCount * 5))
 * Rationale:
 * - Each BREAKING change deducts 25 points (up to 4 breaking changes = 0).
 * - Each RISKY change deducts 5 points.
 * - SAFE changes do not deduct points.
 * - Minimum score is 0; maximum is 100.
 */

const CHANGE_TYPES = {
  FIELD_REMOVED: 'FIELD_REMOVED',
  FIELD_ADDED: 'FIELD_ADDED',
  TYPE_CHANGED: 'TYPE_CHANGED',
  NULLABLE_REMOVED: 'NULLABLE_REMOVED',
  NULLABLE_ADDED: 'NULLABLE_ADDED',
  ENUM_VALUE_REMOVED: 'ENUM_VALUE_REMOVED',
  ENUM_VALUE_ADDED: 'ENUM_VALUE_ADDED',
  REQUIRED_ADDED: 'REQUIRED_ADDED',
  REQUIRED_REMOVED: 'REQUIRED_REMOVED',
};

/**
 * Normalize a type attribute into an array of type strings.
 * E.g., 'string' -> ['string'], ['string', 'null'] -> ['string', 'null']
 */
function normalizeTypes(type) {
  if (!type) return [];
  return Array.isArray(type) ? type : [type];
}

/**
 * Check if a type list allows null.
 */
function isNullable(types) {
  return types.includes('null');
}

/**
 * Get non-null types from a type list.
 */
function nonNullTypes(types) {
  return types.filter(t => t !== 'null');
}

/**
 * Check if two core type lists are equivalent (ignoring nullability).
 */
function typesCompatible(oldTypes, newTypes) {
  const oldCore = [...nonNullTypes(oldTypes)].sort();
  const newCore = [...nonNullTypes(newTypes)].sort();
  if (oldCore.length !== newCore.length) return false;
  return oldCore.every((val, idx) => val === newCore[idx]);
}

function isTypeWidening(oldTypes, newTypes) {
  const oldCore = nonNullTypes(oldTypes);
  const newCore = nonNullTypes(newTypes);
  return oldCore.length === 1 && oldCore[0] === 'integer' &&
    newCore.length === 1 && newCore[0] === 'number';
}

/**
 * Format path cleanly (e.g. "users.address.zipCode" or "(root)").
 */
function formatPath(path) {
  if (!path) return '(root)';
  return path.startsWith('.') ? path.slice(1) : path;
}

/**
 * Compare two schema nodes at a given path and collect structured findings.
 * @param {object} oldSchema
 * @param {object} newSchema
 * @param {string} path - path hierarchy
 * @param {Array} changes - accumulator
 */
function compareSchemas(oldSchema, newSchema, path, changes) {
  if (!oldSchema && !newSchema) return;

  const displayPath = formatPath(path);

  // Field/node added
  if (!oldSchema && newSchema) {
    changes.push({
      classification: 'SAFE',
      severity: 'LOW',
      path: displayPath,
      change: CHANGE_TYPES.FIELD_ADDED,
      before: null,
      after: newSchema.type || 'unknown',
      reason: `Optional field "${displayPath}" added. Existing clients will safely ignore it.`,
      recommendation: 'Safe to deploy. Ensure consumer documentation is updated.'
    });
    return;
  }

  // Field/node removed
  if (oldSchema && !newSchema) {
    changes.push({
      classification: 'BREAKING',
      severity: 'HIGH',
      path: displayPath,
      change: CHANGE_TYPES.FIELD_REMOVED,
      before: oldSchema.type || 'unknown',
      after: null,
      reason: `Field "${displayPath}" was removed. Existing consumers expecting this response field will fail or receive undefined.`,
      recommendation: 'Retain the field for backward compatibility or issue a deprecation grace period.'
    });
    return;
  }

  const oldTypes = normalizeTypes(oldSchema.type);
  const newTypes = normalizeTypes(newSchema.type);
  const oldNullable = isNullable(oldTypes);
  const newNullable = isNullable(newTypes);
  const oldCore = nonNullTypes(oldTypes);
  const newCore = nonNullTypes(newTypes);

  // Check type compatibility
  if (!typesCompatible(oldTypes, newTypes) && !isTypeWidening(oldTypes, newTypes)) {
    const oldCoreStr = oldCore.join(' | ') || 'empty';
    const newCoreStr = newCore.join(' | ') || 'empty';

    // Core types differ -> BREAKING
    if (oldCoreStr !== newCoreStr) {
      changes.push({
        classification: 'BREAKING',
        severity: 'HIGH',
        path: displayPath,
        change: CHANGE_TYPES.TYPE_CHANGED,
        before: oldSchema.type,
        after: newSchema.type,
        reason: `Type changed from "${oldCoreStr}" to "${newCoreStr}". Clients expecting ${oldCoreStr} will fail to parse ${newCoreStr}.`,
        recommendation: `Maintain ${oldCoreStr} format or introduce an explicitly versioned field.`
      });
      return; // Do not inspect nested properties if primary type is incompatible
    }
  }

  // Nullable -> Non-nullable (BREAKING)
  if (oldNullable && !newNullable) {
    changes.push({
      classification: 'BREAKING',
      severity: 'HIGH',
      path: displayPath,
      change: CHANGE_TYPES.NULLABLE_REMOVED,
      before: oldSchema.type,
      after: newSchema.type,
      reason: `Field "${displayPath}" was nullable but is now non-nullable. Consumers or clients that emit or expect null will encounter validation failures.`,
      recommendation: 'Allow null values or verify that all consumers have transitioned.'
    });
  }

  // Non-nullable -> nullable expands the values an API may emit. Consumers that
  // assume a value is always present need review, so this is deliberately RISKY.
  if (!oldNullable && newNullable) {
    changes.push({
      classification: 'RISKY',
      severity: 'MEDIUM',
      path: displayPath,
      change: CHANGE_TYPES.NULLABLE_ADDED,
      before: oldSchema.type,
      after: newSchema.type,
      reason: `Field "${displayPath}" may now be null. Consumers that assume a value is always present can fail.`,
      recommendation: 'Ensure consumers can gracefully handle null representations.'
    });
  }

  // Enum value comparisons
  if (oldSchema.enum || newSchema.enum) {
    const oldEnum = Array.isArray(oldSchema.enum) ? oldSchema.enum : [];
    const newEnum = Array.isArray(newSchema.enum) ? newSchema.enum : [];

    // Removed enum values -> BREAKING
    for (const val of oldEnum) {
      if (!newEnum.includes(val)) {
        changes.push({
          classification: 'BREAKING',
          severity: 'HIGH',
          path: displayPath,
          change: CHANGE_TYPES.ENUM_VALUE_REMOVED,
          before: val,
          after: null,
          reason: `Enum value "${val}" was removed from "${displayPath}". Clients relying on this value will fail during pattern matching or handling.`,
          recommendation: `Retain "${val}" in allowed values or migrate consumers prior to deployment.`
        });
      }
    }

    // Added enum values -> RISKY
    for (const val of newEnum) {
      if (!oldEnum.includes(val)) {
        changes.push({
          classification: 'RISKY',
          severity: 'MEDIUM',
          path: displayPath,
          change: CHANGE_TYPES.ENUM_VALUE_ADDED,
          before: null,
          after: val,
          reason: `New enum value "${val}" added to "${displayPath}". Clients with exhaustive enum handling (e.g. Swift/Kotlin switch without default) may crash or throw.`,
          recommendation: 'Verify that client applications handle unknown enum branches gracefully.'
        });
      }
    }
  }

  // Recurse into object properties
  if (oldCore.includes('object') || newCore.includes('object')) {
    const oldProps = oldSchema.properties || {};
    const newProps = newSchema.properties || {};
    // Schemas from earlier SchemaGuard versions did not emit `required`; absence
    // means the constraint is unknown, not that every property is required.
    const oldRequired = new Set(Array.isArray(oldSchema.required) ? oldSchema.required : []);
    const newRequired = new Set(Array.isArray(newSchema.required) ? newSchema.required : []);
    const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!oldProps[key] && newProps[key] && newRequired.has(key)) {
        changes.push({ classification: 'BREAKING', severity: 'HIGH', path: childPath,
          change: CHANGE_TYPES.REQUIRED_ADDED, before: null, after: true,
          reason: `Required field "${childPath}" was added. Existing request payloads may not include it.`,
          recommendation: 'Add new fields as optional first, or version the contract.' });
        continue;
      }
      if (oldProps[key] && newProps[key]) {
        if (!oldRequired.has(key) && newRequired.has(key)) {
          changes.push({ classification: 'BREAKING', severity: 'HIGH', path: childPath,
            change: CHANGE_TYPES.REQUIRED_ADDED, before: false, after: true,
            reason: `Field "${childPath}" changed from optional to required. Existing payloads may omit it.`,
            recommendation: 'Keep the field optional until all producers and consumers have migrated.' });
        }
        if (oldRequired.has(key) && !newRequired.has(key)) {
          changes.push({ classification: 'BREAKING', severity: 'HIGH', path: childPath,
            change: CHANGE_TYPES.REQUIRED_REMOVED, before: true, after: false,
            reason: `Field "${childPath}" is no longer guaranteed to be present. Existing consumers may rely on it.`,
            recommendation: 'Preserve the field requirement or version the response contract.' });
        }
      }
      compareSchemas(
        oldProps[key] || null,
        newProps[key] || null,
        childPath,
        changes
      );
    }
  }

  // Recurse into array items
  if (oldCore.includes('array') && newCore.includes('array')) {
    if (oldSchema.items || newSchema.items) {
      const childPath = `${path}[]`;
      compareSchemas(
        oldSchema.items || null,
        newSchema.items || null,
        childPath,
        changes
      );
    }
  }
}

/**
 * Calculate deterministic compatibility score.
 * score = max(0, 100 - (breaking * 25) - (risky * 5))
 */
function calculateScore(changes) {
  const breaking = changes.filter(c => c.classification === 'BREAKING').length;
  const risky = changes.filter(c => c.classification === 'RISKY').length;
  return Math.max(0, 100 - (breaking * 25) - (risky * 5));
}

/**
 * Main compatibility analysis function.
 * @param {object} beforeSchema - baseline production schema
 * @param {object} afterSchema - proposed schema
 * @returns {object} structured compatibility assessment
 */
function analyze(beforeSchema, afterSchema) {
  if (!beforeSchema || !afterSchema) {
    throw new Error('Both beforeSchema and afterSchema must be provided');
  }

  const changes = [];
  compareSchemas(beforeSchema, afterSchema, '', changes);

  const breaking = changes.filter(c => c.classification === 'BREAKING').length;
  const risky = changes.filter(c => c.classification === 'RISKY').length;
  const safe = changes.filter(c => c.classification === 'SAFE').length;
  const score = calculateScore(changes);

  let classification = 'SAFE';
  if (breaking > 0) {
    classification = 'BREAKING';
  } else if (risky > 0) {
    classification = 'RISKY';
  }

  return {
    classification,
    score,
    summary: {
      breaking,
      risky,
      safe,
      total: changes.length
    },
    changes
  };
}

module.exports = {
  analyze,
  compareSchemas,
  calculateScore,
  CHANGE_TYPES
};
