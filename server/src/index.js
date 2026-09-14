'use strict';
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const demoRoutes = require('./routes/demoRoutes');
const schemaRoutes = require('./routes/schemaRoutes');
const compatibilityRoutes = require('./routes/compatibilityRoutes');
const observationRoutes = require('./routes/observationRoutes');
const githubRoutes = require('./routes/githubRoutes');

const app = express();

// Security & middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 1MB payload limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'schemaguard-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/demo', demoRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/compatibility', compatibilityRoutes);
app.use('/api/observe', observationRoutes);
app.use('/api/github', githubRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SchemaGuard API running on port ${PORT}`);
  });
}

module.exports = app;