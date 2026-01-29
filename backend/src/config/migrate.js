const pool = require('./database');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    console.log('🔄 Running database migrations...');

    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );

    await pool.query(schemaSQL);

    console.log('✅ Database migrations completed successfully!');
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (require.main === module) {
      process.exit(1);
    } else {
      // Throw error if running as a module so the caller knows
      throw error;
    }
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
