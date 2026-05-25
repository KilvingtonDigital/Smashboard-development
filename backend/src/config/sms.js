const twilio = require('twilio');

const sendSMS = async ({ to, body }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('⚠️ Twilio credentials missing in environment variables. SMS alert skipped.');
    return { success: false, error: 'Credentials missing' };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to
    });
    console.log(`[SMS SUCCESS] Alert sent to ${to}. Message SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error(`[SMS ERROR] Failed to send alert to ${to}:`, err);
    return { success: false, error: err.message };
  }
};

module.exports = { sendSMS };
