'use strict';
const { inferSchema, inferFromMultiple } = require('../services/schemaInferenceService');

const infer = (req, res) => {
  try {
    const { data, observations } = req.body;

    if (observations && Array.isArray(observations)) {
      if (observations.length === 0) {
        return res.status(400).json({ error: 'observations array must not be empty' });
      }
      const schema = inferFromMultiple(observations);
      return res.json({ schema });
    }

    if (data === undefined) {
      return res.status(400).json({ error: 'Request body must include "data" or "observations"' });
    }

    const schema = inferSchema(data);
    return res.json({ schema });
  } catch (err) {
    console.error('Schema inference error:', err.message);
    return res.status(500).json({ error: 'Schema inference failed' });
  }
};

module.exports = { infer };

