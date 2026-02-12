const { Pool } = require('pg');
require('dotenv').config();

// Prefer Public URL if available (to bypass internal network issues), otherwise use Internal
const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }, // Required for Railway (Public or Private)
  connectionTimeoutMillis: 10000 // Give it 10 seconds
});

pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

module.exports = pool;
