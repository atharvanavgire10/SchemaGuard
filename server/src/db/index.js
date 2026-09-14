'use strict';
const { Pool } = require('pg');

let pool = null;
let dbAvailable = false;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
      });
      dbAvailable = true;
    } catch (err) {
      console.warn('Database connection failed, running in memory-only mode:', err.message);
    }
  }
  return pool;
}

async function query(sql, params = []) {
  const p = getPool();
  if (!p) throw new Error('Database not configured');
  return p.query(sql, params);
}

function isAvailable() {
  return dbAvailable && !!getPool();
}

module.exports = { query, isAvailable, getPool };

