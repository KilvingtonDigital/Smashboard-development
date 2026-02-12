// DB Diagnostics - Forced Update: 21:24
const { Client } = require('pg');
const https = require('https');
require('dotenv').config();

const req = https.get('https://www.google.com', (res) => {
    const time = Date.now() - start;
    console.log(`   ✅ Internet Access: OK (${res.statusCode}) - ${time}ms`);
    resolve(true);
});
req.on('error', (e) => {
    console.log(`   ❌ Internet Access: FAILED. Error: ${e.message}`);
    resolve(false);
});
req.setTimeout(2000, () => {
    if (req.destroyed) return; // Already finished?
    console.log('   ❌ Internet Access: TIMEOUT (2s)');
    req.abort();
    resolve(false);
});

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

    console.log('Checking Outbound Internet Access...');
    await checkInternet();

    const publicUrl = process.env.DATABASE_PUBLIC_URL;
    const internalUrl = process.env.DATABASE_URL;

    console.log(`Public URL Var Present: ${publicUrl ? 'YES' : 'NO'}`);
    if (publicUrl) {
        console.log(`Public URL Target: ${publicUrl.replace(/:[^:]+@/, ':****@')}`);
    }
    console.log(`Internal URL Target: ${internalUrl ? internalUrl.replace(/:[^:]+@/, ':****@') : 'MISSING'}`);

    // Test 0: Public URL (Priority)
    if (publicUrl) {
        console.log('\n--- PUBLIC URL TESTS ---');

        // Variant A: Permissive SSL (Most likely)
        await testConnection('Public A: Permissive SSL', {
            connectionString: publicUrl,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000
        });

        // Variant B: No SSL
        await testConnection('Public B: No SSL', {
            connectionString: publicUrl,
            ssl: false,
            connectionTimeoutMillis: 10000
        });

        // Variant C: Strict SSL
        await testConnection('Public C: Strict SSL', {
            connectionString: publicUrl,
            ssl: { rejectUnauthorized: true },
            connectionTimeoutMillis: 10000
        });

        // Variant D: No SSL + Force IPv4
        await testConnection('Public D: No SSL + Force IPv4', {
            connectionString: publicUrl,
            ssl: false,
            family: 4, // Force IPv4
            connectionTimeoutMillis: 10000
        });
    } else {
        console.log('⚠️ SKIPPING Public URL Test (Variable not set)');
    }

    // Test 1: Internal IPv6 Force (Priority Fix)
    await testConnection('Internal: IPv6 Force', {
        connectionString: process.env.DATABASE_URL,
        family: 6, // Force IPv6
        ssl: false,
        connectionTimeoutMillis: 5000
    });

    // Test 2: Internal SSL Disabled
    await testConnection('Internal: SSL Disabled', {
        connectionString: process.env.DATABASE_URL,
        ssl: false,
        connectionTimeoutMillis: 5000
    });

    // Test 3: Standard / Default (Let pg decide) - Note: This hangs for 2m without timeout
    await testConnection('Default (No Config)', {
        connectionString: process.env.DATABASE_URL,
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
