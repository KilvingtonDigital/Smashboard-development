require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.SMTP_PASS); // We use the API Key (SMTP_PASS)

const sendEmail = async ({ to, subject, text, html }) => {
    try {
        console.log(`📨 Sending email via Resend API to: ${to}`);

        const data = await resend.emails.send({
            from: process.env.SMTP_FROM || 'onboarding@resend.dev',
            to: to,
            subject: subject,
            html: html,
            text: text
        });

        if (data.error) {
            console.error('❌ Resend API Error:', data.error);
            return { success: false, error: data.error };
        }

        console.log('✅ Email sent successfully via API:', data.id);
        return { success: true, id: data.id };
    } catch (error) {
        console.error('❌ Email Send Exception:', error);
        return { success: false, error };
    }
};

module.exports = { sendEmail };
