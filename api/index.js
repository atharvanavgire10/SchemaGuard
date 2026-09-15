'use strict';

// Vercel invokes this exported Express application as one Node.js Function.
// The app itself owns all routing and only calls listen() for local execution.
module.exports = require('../server/src/index');
