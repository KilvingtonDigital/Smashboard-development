const nodemailer = require('nodemailer');

const createTransporter = () => {
    // If SMTP vars are present, use them
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // Otherwise, return null (simulated mode)
    return null;
};

const sendEmail = async ({ to, subject, html, text }) => {
    const transporter = createTransporter();
    const from = process.env.SMTP_FROM || '"SmashBoard" <noreply@smashboard.app>';

    // Log for development/testing if no actual mailer is configured
    if (!transporter) {
        console.log('--- 📧 MOCK EMAIL SEND 📧 ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Preview URL: (Mock - No SMTP Configured)`);
        console.log('--- Body ---');
        console.log(text || html);
        console.log('-----------------------------');
        return { success: true, mock: true };
    }

    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            text, // plain text body
            html  // html body
        });

        console.log('Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
};

module.exports = { sendEmail };
