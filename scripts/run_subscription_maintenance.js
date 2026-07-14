const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

function policyForDays(daysUntilEnd, graceDays = 7) {
  if (daysUntilEnd >= 0) return 'current';
  if (Math.abs(daysUntilEnd) <= graceDays) return 'past_due';
  return 'suspended';
}

function sslConfig() {
  if (process.env.DB_SSL !== 'true') return undefined;
  return {
    ca: fs.readFileSync(path.resolve(process.cwd(), process.env.DB_SSL_CA_PATH || 'config/aiven-ca.pem')),
    rejectUnauthorized: true,
  };
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sslConfig(),
  });
  const graceDays = Math.min(Math.max(Number(process.env.SUBSCRIPTION_GRACE_DAYS || 7), 1), 30);
  const sendEnabled = process.env.SUBSCRIPTION_REMINDERS_SEND === 'true';
  const apply = process.env.SUBSCRIPTION_MAINTENANCE_APPLY === 'true';
  const smtpEnabled = process.env.SMTP_ENABLED === 'true';
  const reminderDays = new Set([14, 7, 3, 1]);
  const summary = { current: 0, past_due: 0, suspended: 0, reminders_sent: 0, reminders_skipped: 0, reminders_failed: 0 };

  try {
    const [rows] = await connection.query(
      `SELECT s.id AS subscription_id, s.tenant_id, s.current_period_end,
              t.name AS tenant_name, t.status AS tenant_status,
              DATEDIFF(DATE(s.current_period_end), CURRENT_DATE()) AS days_until_end,
              u.email AS admin_email, u.name AS admin_name
       FROM subscriptions s
       JOIN tenants t ON t.id = s.tenant_id
       LEFT JOIN user_tenants ut ON ut.tenant_id = t.id AND ut.role = 'admin' AND ut.is_active = TRUE
       LEFT JOIN users u ON u.id = ut.user_id AND u.status = 'active'
       WHERE t.status NOT IN ('archived', 'inactive')
       ORDER BY s.tenant_id, u.id`
    );

    const processedTenants = new Set();
    for (const row of rows) {
      const daysUntilEnd = Number(row.days_until_end);
      const policy = policyForDays(daysUntilEnd, graceDays);
      if (!processedTenants.has(row.tenant_id)) {
        processedTenants.add(row.tenant_id);
        summary[policy]++;
        if (apply && policy === 'past_due' && row.tenant_status !== 'past_due') {
          await connection.query("UPDATE tenants SET status = 'past_due', updated_at = NOW() WHERE id = ?", [row.tenant_id]);
          await connection.query("UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE id = ?", [row.subscription_id]);
        } else if (apply && policy === 'suspended' && row.tenant_status !== 'suspended') {
          await connection.query("UPDATE tenants SET status = 'suspended', updated_at = NOW() WHERE id = ?", [row.tenant_id]);
          await connection.query("UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE id = ?", [row.subscription_id]);
        }
      }

      if (!reminderDays.has(daysUntilEnd) || !row.admin_email) continue;
      if (!apply) {
        summary.reminders_skipped++;
        continue;
      }
      const [existing] = await connection.query(
        `SELECT id FROM subscription_reminder_deliveries
         WHERE subscription_id = ? AND recipient_email = ? AND reminder_days = ?
           AND period_end = DATE(?)`,
        [row.subscription_id, row.admin_email, daysUntilEnd, row.current_period_end]
      );
      if (existing.length) continue;

      let status = 'skipped';
      let errorMessage = null;
      try {
        if (sendEnabled && smtpEnabled) {
          await transporter().sendMail({
            from: `"Hall Sync" <${process.env.SMTP_FROM}>`,
            to: row.admin_email,
            subject: `Hall Sync subscription expires in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}`,
            html: `<p>Hello ${row.admin_name || 'Venue owner'},</p><p>Your Hall Sync subscription for ${row.tenant_name} expires in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}.</p><p>Please renew from Billing Settings to avoid read-only grace mode.</p>`,
          });
          status = 'sent';
          summary.reminders_sent++;
        } else {
          summary.reminders_skipped++;
        }
      } catch (error) {
        status = 'failed';
        errorMessage = String(error.message || error).slice(0, 500);
        summary.reminders_failed++;
      }
      await connection.query(
        `INSERT INTO subscription_reminder_deliveries
         (subscription_id, tenant_id, recipient_email, reminder_days, period_end, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, DATE(?), ?, ?, IF(? = 'sent', NOW(), NULL))`,
        [row.subscription_id, row.tenant_id, row.admin_email, daysUntilEnd, row.current_period_end, status, errorMessage, status]
      );
    }
    console.log(JSON.stringify({ ok: summary.reminders_failed === 0, mode: apply ? 'apply' : 'dry-run', grace_days: graceDays, send_enabled: sendEnabled, ...summary }, null, 2));
    if (summary.reminders_failed > 0) process.exitCode = 2;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Subscription maintenance failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { policyForDays };
