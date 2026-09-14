'use strict';
const { analyze } = require('../services/compatibilityService');

const analyzeCompatibility = (req, res) => {
  try {
    const { before, after } = req.body;

    if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || !before.type || !after.type) {
      return res.status(400).json({ error: 'Request body must include "before" and "after" schemas' });
    }

    const result = analyze(before, after);
    return res.json(result);
  } catch (err) {
    console.error('Compatibility analysis error:', err.message);
    return res.status(500).json({ error: 'Compatibility analysis failed' });
  }
};

module.exports = { analyzeCompatibility };

