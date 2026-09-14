'use strict';
const express = require('express');
const { infer } = require('../controllers/schemaController');
const router = express.Router();

router.post('/infer', infer);

module.exports = router;
