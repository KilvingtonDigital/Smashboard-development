require('dotenv').config();
const nodemailer = require('nodemailer');

const runDiagnostics = async () => {
    console.log('========================================');
    console.log('📧 EMAIL CONFIGURATION DIAGNOSTICS');
    console.log('========================================');

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = process.env.SMTP_PORT || 587;
    const secure = process.env.SMTP_SECURE === 'true';

    console.log(`SMTP Host: ${host ? host : '❌ MISSING'}`);
    console.log(`SMTP User: ${user ? user : '❌ MISSING'}`);
    console.log(`SMTP Pass: ${pass ? '******** (Present)' : '❌ MISSING'}`);
    console.log(`SMTP Port: ${port}`);
    console.log(`SMTP Secure: ${secure}`);

    if (!host || !user || !pass) {
        console.error('\n❌ CRITICAL: Missing SMTP Environment Variables!');
        console.error('You need to add SMTP_HOST, SMTP_USER, and SMTP_PASS to Railway.');
        return;
    }

    console.log('\n🔄 Attempting to create transporter...');
    try {
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass }
        });

        console.log('🔄 Verifying connection...');
        await transporter.verify();
        console.log('✅ Connection Verified! Credentials are correct.');

        // Optional: Send test email if an argument is provided
        const testRecipient = process.argv[2];
        if (testRecipient) {
            console.log(`\n🔄 Sending test email to: ${testRecipient}`);
            await transporter.sendMail({
                from: '"SmashBoard Diagnostics" <noreply@smashboard.app>',
                to: testRecipient,
                subject: 'SmashBoard Email Test',
                text: 'If you are reading this, the email configuration is working perfectly!',
            });
            console.log('✅ Test email sent successfully!');
        } else {
            console.log('\n(To send a test email, pass an email address as an argument)');
        }

    } catch (error) {
        console.error('\n❌ CHECK FAILED:', error.message);
        if (error.code === 'EAUTH') console.error('   -> Auth failed. Check username/password.');
        if (error.code === 'ESOCKET') console.error('   -> Connection failed. Check host/port.');
    }
};

// runDiagnostics();
module.exports = runDiagnostics;
