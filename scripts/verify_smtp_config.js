const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

function value(name) {
  return String(process.env[name] || '').trim();
}

function missing(names) {
  return names.filter((name) => !value(name));
}

function sanitizeError(error) {
  const message = String(error?.response || error?.message || 'SMTP verification failed');
  if (/535|authentication failed|invalid login/i.test(message)) {
    return 'SMTP authentication failed. Check Brevo SMTP login, SMTP key value, and authorized VPS IP.';
  }
  if (/sender|from|domain|not verified|unauthorized/i.test(message)) {
    return 'SMTP sender/domain is not verified or authorized.';
  }
  if (/timeout|etimedout|econnrefused|enotfound/i.test(message)) {
    return 'SMTP connection failed. Check host, port, firewall, and provider status.';
  }
  return message.replace(/(password|pass|token|secret|key)=\S+/gi, '$1=[REDACTED]');
}

async function main() {
  if (process.env.SMTP_ENABLED !== 'true') {
    console.log(JSON.stringify({
      ok: false,
      status: 'disabled',
      message: 'SMTP_ENABLED is not true',
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missingKeys = missing(required);
  if (missingKeys.length) {
    console.log(JSON.stringify({
      ok: false,
      status: 'incomplete',
      missing: missingKeys,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const transporter = nodemailer.createTransport({
    host: value('SMTP_HOST'),
    port: Number(value('SMTP_PORT') || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: value('SMTP_USER'),
      pass: value('SMTP_PASS'),
    },
  });

  try {
    await transporter.verify();
    console.log(JSON.stringify({
      ok: true,
      status: 'configured',
      message: 'SMTP login verified successfully',
      host: value('SMTP_HOST'),
      port: Number(value('SMTP_PORT') || 587),
      user: value('SMTP_USER'),
      from: value('SMTP_FROM'),
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      status: 'failed',
      message: sanitizeError(error),
      provider_code: error?.code || error?.responseCode || null,
      host: value('SMTP_HOST'),
      port: Number(value('SMTP_PORT') || 587),
      user: value('SMTP_USER'),
      from: value('SMTP_FROM'),
    }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    status: 'error',
    message: sanitizeError(error),
  }, null, 2));
  process.exitCode = 1;
});
