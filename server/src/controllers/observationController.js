'use strict';
const { ingest, getTrafficStats, calculateImpact } = require('../services/observationService');
const { analyze } = require('../services/compatibilityService');
const demoData = require('../data/demoData');

const ingestObservation = async (req, res) => {
  try {
    const result = await ingest(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('required')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Observation ingest error:', err.message);
    return res.status(500).json({ error: 'Failed to store observation' });
  }
};

const getTraffic = (req, res) => {
  const { endpoint } = req.query;
  const stats = getTrafficStats(endpoint);
  return res.json(stats);
};

const analyzeWithImpact = (req, res) => {
  try {
    const { before, after, endpoint } = req.body;
    if (!before || !after) {
      return res.status(400).json({ error: '"before" and "after" schemas are required' });
    }

    const result = analyze(before, after);

    // Calculate impact for breaking changes
    const removedFields = result.changes
      .filter(c => c.change === 'FIELD_REMOVED')
      .map(c => c.path.replace(/^\.|^/, '').replace(/^\.$/, '')); // strip leading dot

    const fieldImpacts = calculateImpact(removedFields, endpoint);

    // Aggregate affected traffic
    let maxAffectedPct = 0;
    const affectedClients = new Set();
    for (const fi of fieldImpacts) {
      if (fi.affectedTrafficPct > maxAffectedPct) maxAffectedPct = fi.affectedTrafficPct;
      fi.affectedClients.forEach(c => affectedClients.add(c));
    }

    return res.json({
      ...result,
      impact: {
        affectedTrafficPct: maxAffectedPct,
        affectedClients: [...affectedClients],
        fieldImpacts,
        traffic: getTrafficStats()
      }
    });
  } catch (err) {
    console.error('Analyze with impact error:', err.message);
    return res.status(500).json({ error: 'Analysis failed' });
  }
};

const getDemoProject = (req, res) => {
  const stats = getTrafficStats();
  return res.json({
    project: {
      name: 'E-Commerce API',
      endpoints: 24,
      ...stats
    },
    contracts: demoData.baseSchema
  });
};

module.exports = { ingestObservation, getTraffic, analyzeWithImpact, getDemoProject };

