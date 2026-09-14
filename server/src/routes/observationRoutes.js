'use strict';
const express = require('express');
const {
  ingestObservation,
  getTraffic,
  analyzeWithImpact,
  getDemoProject
} = require('../controllers/observationController');

const router = express.Router();

// Ingest a production observation
router.post('/', ingestObservation);

// Get traffic stats
router.get('/traffic', getTraffic);

// Analyze with impact
router.post('/analyze', analyzeWithImpact);

// Demo project overview
router.get('/project', getDemoProject);

module.exports = router;

