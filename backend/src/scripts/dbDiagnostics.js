const { Client } = require('pg');
require('dotenv').config();

const testConnection = async (name, config) => {
    console.log(`\n🧪 Testing Config: ${name}`);
    console.log(`   SSL Setting: ${JSON.stringify(config.ssl)}`);

    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query('SELECT NOW()');
        console.log(`   ✅ SUCCESS! Connected. Time: ${res.rows[0].now}`);
        await client.end();
        return true;
    } catch (err) {
        console.log(`   ❌ FAILED. Error: ${err.message}`);
        if (err.code) console.log(`      Code: ${err.code}`);
        // console.log(err); // Full error for deep debug
        try { await client.end(); } catch (e) { }
        return false;
    }
};

const runDiagnostics = async () => {
    console.log('========================================');
    console.log('🔍 DATABASE CONNECTION DIAGNOSTICS');
    console.log('========================================');

    if (!process.env.DATABASE_URL) {
        console.error('❌ ERROR: DATABASE_URL environment variable is missing!');
        return;
    }

    // Masked URL for verification
    const maskedUrl = process.env.DATABASE_URL.replace(/:[^:]+@/, ':****@');
    console.log(`Target URL: ${maskedUrl}`);

    // Test 1: Standard / Default (Let pg decide)
    await testConnection('Default (No Config)', {
        connectionString: process.env.DATABASE_URL,
    });

    // Test 2: Internal Network (SSL False)
    await testConnection('SSL Disabled (Internal)', {
        connectionString: process.env.DATABASE_URL,
        ssl: false,
        connectionTimeoutMillis: 5000
    });

    // Test 3: Standard Railway (SSL Permissive)
    await testConnection('SSL Permissive (rejectUnauthorized: false)', {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    // Test 4: Force SSL (Strict)
    await testConnection('SSL Strict (rejectUnauthorized: true)', {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: true },
        connectionTimeoutMillis: 5000
    });

    console.log('========================================');
    console.log('🏁 DIAGNOSTICS COMPLETE');
    console.log('========================================');
};

module.exports = runDiagnostics;
