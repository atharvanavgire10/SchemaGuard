'use strict';

/**
 * SchemaGuard Compatibility Analysis Service
 *
 * Compares an OLD schema against a NEW schema and classifies all changes.
 *
 * CLASSIFICATION RULES:
 * - BREAKING: removed field, type narrowed/changed incompatibly, nullable→non-nullable,
 *             removed enum value, required field added
 * - RISKY:    new enum value added, format changed, nullable behavior uncertain
 * - SAFE:     optional field added, adding nullable fields, documentation-only
 *
 * SCORING ALGORITHM:
 * score = max(0, 100 - (breakingCount * 25) - (riskyCount * 5))
 * Rationale: each breaking change is high-severity (-25); each risky change is low-severity (-5).
 * Score of 100 = fully safe. Score of 0+ = multiple critical issues.
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
};

/**
 * Normalize a type to an array of strings.
 */
function normalizeTypes(type) {
  if (!type) return [];
  return Array.isArray(type) ? type : [type];
}

/**
 * Check if a type set is nullable.
 */
function isNullable(types) {
  return types.includes('null');
}

/**
 * Get non-null types from a type set.
 */
function nonNullTypes(types) {
  return types.filter(t => t !== 'null');
}

/**
 * Check if two type sets are compatible (ignoring null).
 * Compatible means the same core types.
 */
function typesCompatible(oldTypes, newTypes) {
  const oldCore = nonNullTypes(oldTypes).sort();
  const newCore = nonNullTypes(newTypes).sort();
  return JSON.stringify(oldCore) === JSON.stringify(newCore);
}

/**
 * Compare two schema nodes at a given path and collect changes.
 * @param {object} oldSchema
 * @param {object} newSchema
 * @param {string} path - dot-notation path for reporting
 * @param {Array} changes - accumulator
 */
function compareSchemas(oldSchema, newSchema, path, changes) {
  if (!oldSchema && !newSchema) return;

  // Schema was added (new field)
  if (!oldSchema) {
    changes.push({
      classification: 'SAFE',
      severity: 'LOW',
      path,
      change: CHANGE_TYPES.FIELD_ADDED,
      before: null,
      after: newSchema.type,
      reason: 'New optional field added. Existing clients can safely ignore it.'
    });
    return;
  }

  // Schema was removed (field removed)
  if (!newSchema) {
    changes.push({
      classification: 'BREAKING',
      severity: 'HIGH',
      path,
      change: CHANGE_TYPES.FIELD_REMOVED,
      before: oldSchema.type,
      after: null,
      reason: `Field "${path}" was removed. Existing clients that read this field will fail or receive undefined.`
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
  if (!typesCompatible(oldTypes, newTypes)) {
    // Special cases for type changes
    const oldCoreStr = oldCore.join('|');
    const newCoreStr = newCore.join('|');

    // If only nullability changed (not core type), handle separately below
    if (oldCoreStr !== newCoreStr) {
      changes.push({
        classification: 'BREAKING',
        severity: 'HIGH',
        path,
        change: CHANGE_TYPES.TYPE_CHANGED,
        before: oldSchema.type,
        after: newSchema.type,
        reason: `Type changed from "${oldCoreStr}" to "${newCoreStr}". Clients expecting ${oldCoreStr} will fail to parse ${newCoreStr}.`
      });
      return; // Don't check further if type is incompatible
    }
  }

  // Nullable → non-nullable (BREAKING: clients may send null, API will reject)
  if (oldNullable && !newNullable) {
    changes.push({
      classification: 'BREAKING',
      severity: 'HIGH',
      path,
      change: CHANGE_TYPES.NULLABLE_REMOVED,
      before: oldSchema.type,
      after: newSchema.type,
      reason: `Field "${path}" was nullable but is now non-nullable. Clients that send or observe null values will encounter errors.`
    });
  }

  // Non-nullable → nullable (SAFE: more permissive)
  if (!oldNullable && newNullable) {
    changes.push({
      classification: 'SAFE',
      severity: 'LOW',
      path,
      change: CHANGE_TYPES.NULLABLE_ADDED,
      before: oldSchema.type,
      after: newSchema.type,
      reason: `Field "${path}" is now nullable. This is backwards compatible.`
    });
  }

  // Enum value comparisons (only if both have enums)
  if (oldSchema.enum || newSchema.enum) {
    const oldEnum = oldSchema.enum || [];
    const newEnum = newSchema.enum || [];

    // Removed enum values → BREAKING
    for (const val of oldEnum) {
      if (!newEnum.includes(val)) {
        changes.push({
          classification: 'BREAKING',
          severity: 'HIGH',
          path,
          change: CHANGE_TYPES.ENUM_VALUE_REMOVED,
          before: val,
          after: null,
          reason: `Enum value "${val}" was removed from "${path}". Clients that check for this value or send it will fail.`
        });
      }
    }

    // Added enum values → RISKY
    for (const val of newEnum) {
      if (!oldEnum.includes(val)) {
        changes.push({
          classification: 'RISKY',
          severity: 'MEDIUM',
          path,
          change: CHANGE_TYPES.ENUM_VALUE_ADDED,
          before: null,
          after: val,
          reason: `New enum value "${val}" added to "${path}". Clients with exhaustive enum handling (switch statements without default) may break.`
        });
      }
    }
  }

  // Recurse into object properties
  if (oldCore.includes('object') || newCore.includes('object')) {
    const oldProps = oldSchema.properties || {};
    const newProps = newSchema.properties || {};
    const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

    for (const key of allKeys) {
      compareSchemas(
        oldProps[key] || null,
        newProps[key] || null,
        path ? `${path}.${key}` : key,
        changes
      );
    }
  }

  // Recurse into array items
  if (oldCore.includes('array') && newCore.includes('array')) {
    if (oldSchema.items || newSchema.items) {
      compareSchemas(
        oldSchema.items || null,
        newSchema.items || null,
        `${path}[]`,
        changes
      );
    }
  }
}

/**
 * Calculate compatibility score.
 * score = max(0, 100 - (breakingCount * 25) - (riskyCount * 5))
 */
function calculateScore(changes) {
  const breaking = changes.filter(c => c.classification === 'BREAKING').length;
  const risky = changes.filter(c => c.classification === 'RISKY').length;
  return Math.max(0, 100 - (breaking * 25) - (risky * 5));
}

/**
 * Main compatibility analysis function.
 * @param {object} beforeSchema - the old schema
 * @param {object} afterSchema - the new schema
 * @returns {object} analysis result
 */
function analyze(beforeSchema, afterSchema) {
  const changes = [];

  // Compare at the root level
  compareSchemas(beforeSchema, afterSchema, '', changes);

  const breaking = changes.filter(c => c.classification === 'BREAKING').length;
  const risky = changes.filter(c => c.classification === 'RISKY').length;
  const safe = changes.filter(c => c.classification === 'SAFE').length;
  const score = calculateScore(changes);

  let classification = 'SAFE';
  if (breaking > 0) classification = 'BREAKING';
  else if (risky > 0) classification = 'RISKY';

  return {
    classification,
    score,
    summary: { breaking, risky, safe, total: changes.length },
    changes
  };
}

module.exports = { analyze, compareSchemas, calculateScore, CHANGE_TYPES };
