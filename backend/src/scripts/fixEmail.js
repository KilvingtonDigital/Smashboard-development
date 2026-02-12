require('dotenv').config();
const { Client } = require('pg');

const correctEmail = async () => {
    // Determine connection string
    const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error("❌ No DATABASE_URL found. Are you running this locally with a .env file?");
        process.exit(1);
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false } // Permissive SSL for scripts
    });

    try {
        console.log("🔄 Connecting to database...");
        await client.connect();
        console.log('✅ Connected.');

        // The Email from the screenshot (ID 5)
        const wrongEmail = 'rickykwhittakerrw@gmail.com';
        // The Email the user WANTS to use
        const correctEmail = 'rickykwhittaker.rw@gmail.com';

        console.log(`🔄 Attempting to update email...`);
        console.log(`   FROM: ${wrongEmail}`);
        console.log(`   TO:   ${correctEmail}`);

        const res = await client.query(
            'UPDATE users SET email = $1 WHERE email = $2 RETURNING id, email',
            [correctEmail, wrongEmail]
        );

        if (res.rowCount > 0) {
            console.log(`\n✅ SUCCESS! Updated User ID ${res.rows[0].id} to: ${res.rows[0].email}`);
            console.log("   You can now try 'Forgot Password' with this email.");
        } else {
            console.log('\n❌ UPDATE FAILED: User not found with the "wrong" email.');
            console.log("   Please check the database to see exactly what is currently stored.");
        }

    } catch (error) {
        console.error('\n❌ DATABASE ERROR:', error.message);
    } finally {
        await client.end();
        process.exit();
    }
};

correctEmail();
