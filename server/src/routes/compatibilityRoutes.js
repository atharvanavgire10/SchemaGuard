'use strict';
const express = require('express');
const { analyzeCompatibility } = require('../controllers/compatibilityController');
const router = express.Router();

router.post('/analyze', analyzeCompatibility);

module.exports = router;
