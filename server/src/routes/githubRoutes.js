'use strict';
const express = require('express');
const { analyzePR, getStatus } = require('../controllers/githubController');
const router = express.Router();

router.get('/status', getStatus);
router.post('/analyze-pr', analyzePR);

module.exports = router;

