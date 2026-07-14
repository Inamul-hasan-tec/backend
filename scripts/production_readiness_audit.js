const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { verifyBackup } = require('./verify_database_backup');

dotenv.config({ path: path.join(__dirname, '../.env') });

function isSet(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

function isPlaceholder(value = '') {
  return /your-|change-this|replace-|localhost|example|gmail\.com/i.test(value);
}

function bool(name) {
  return String(process.env[name] || '').toLowerCase() === 'true';
}

function resolveDbSSL() {
  const sslMode = process.env.DB_SSL_MODE || process.env['SSL Mode'] || '';
  const enabled =
    bool('DB_SSL') ||
    /required|verify-ca|verify_identity|verify-full/i.test(sslMode);

  const caPath =
    process.env.DB_SSL_CA_PATH ||
    process.env['SSL CA File'] ||
    'config/aiven-ca.pem';

  return {
    enabled,
    caPath,
    caExists: enabled ? fs.existsSync(path.resolve(process.cwd(), caPath)) : false,
  };
}

function check(checks, level, name, pass, detail) {
  checks.push({ level, name, pass, detail });
}

async function main() {
  const checks = [];
  const dbSSL = resolveDbSSL();

  check(checks, 'blocker', 'NODE_ENV is production', process.env.NODE_ENV === 'production', process.env.NODE_ENV || '<unset>');
  check(checks, 'blocker', 'JWT_SECRET configured', isSet('JWT_SECRET') && !isPlaceholder(process.env.JWT_SECRET), isSet('JWT_SECRET') ? '<set>' : '<missing>');
  check(
    checks,
    'blocker',
    'JWT access token expiry follows 8-hour pilot policy',
    process.env.JWT_EXPIRES_IN === '8h',
    process.env.JWT_EXPIRES_IN || '<unset>'
  );
  check(checks, 'blocker', 'CORS_ORIGIN configured', isSet('CORS_ORIGIN'), process.env.CORS_ORIGIN || '<missing>');
  check(
    checks,
    'blocker',
    'CORS_ORIGIN is not wildcard',
    isSet('CORS_ORIGIN') && process.env.CORS_ORIGIN.trim() !== '*',
    process.env.CORS_ORIGIN || '<missing>'
  );
  check(
    checks,
    'warning',
    'CORS_ORIGIN avoids localhost for production',
    isSet('CORS_ORIGIN') && !/localhost|127\.0\.0\.1/i.test(process.env.CORS_ORIGIN),
    process.env.CORS_ORIGIN || '<missing>'
  );
  check(checks, 'blocker', 'Database SSL enabled', dbSSL.enabled, dbSSL.enabled ? 'enabled' : 'disabled');
  check(checks, 'blocker', 'Database SSL CA file exists', !dbSSL.enabled || dbSSL.caExists, dbSSL.caPath);
  check(checks, 'warning', 'SMTP enabled', bool('SMTP_ENABLED'), process.env.SMTP_ENABLED || '<unset>');
  check(
    checks,
    'warning',
    'SMTP sender configured',
    isSet('SMTP_HOST') && isSet('SMTP_USER') && isSet('SMTP_PASS') && isSet('SMTP_FROM'),
    [
      `host=${isSet('SMTP_HOST') ? '<set>' : '<missing>'}`,
      `user=${isSet('SMTP_USER') ? '<set>' : '<missing>'}`,
      `pass=${isSet('SMTP_PASS') ? '<set>' : '<missing>'}`,
      `from=${isSet('SMTP_FROM') ? '<set>' : '<missing>'}`,
    ].join(', ')
  );
  check(
    checks,
    'warning',
    'Cloudinary configured',
    isSet('CLOUDINARY_CLOUD_NAME') && isSet('CLOUDINARY_API_KEY') && isSet('CLOUDINARY_API_SECRET'),
    [
      `cloud=${isSet('CLOUDINARY_CLOUD_NAME') ? '<set>' : '<missing>'}`,
      `key=${isSet('CLOUDINARY_API_KEY') ? '<set>' : '<missing>'}`,
      `secret=${isSet('CLOUDINARY_API_SECRET') ? '<set>' : '<missing>'}`,
    ].join(', ')
  );
  check(checks, 'warning', 'UPI_ID configured for manual subscriptions', isSet('UPI_ID') && !isPlaceholder(process.env.UPI_ID), isSet('UPI_ID') ? '<set>' : '<missing>');
  check(
    checks,
    'warning',
    'Error monitoring DSN configured',
    isSet('ERROR_MONITORING_DSN') && !isPlaceholder(process.env.ERROR_MONITORING_DSN),
    isSet('ERROR_MONITORING_DSN') ? '<set>' : '<missing>'
  );
  check(
    checks,
    'warning',
    'HTTPS uptime health URL configured',
    /^https:\/\//i.test(process.env.UPTIME_MONITOR_HEALTH_URL || '') && !isPlaceholder(process.env.UPTIME_MONITOR_HEALTH_URL),
    process.env.UPTIME_MONITOR_HEALTH_URL || '<missing>'
  );
  check(
    checks,
    'warning',
    'HTTPS uptime frontend URL configured',
    /^https:\/\//i.test(process.env.UPTIME_MONITOR_FRONTEND_URL || '') && !isPlaceholder(process.env.UPTIME_MONITOR_FRONTEND_URL),
    process.env.UPTIME_MONITOR_FRONTEND_URL || '<missing>'
  );
  check(
    checks,
    'warning',
    'Operations alert recipient configured',
    isSet('OPS_ALERT_RECIPIENT') && !isPlaceholder(process.env.OPS_ALERT_RECIPIENT),
    isSet('OPS_ALERT_RECIPIENT') ? '<set>' : '<missing>'
  );

  const ssl =
    dbSSL.enabled && dbSSL.caExists
      ? {
          ca: fs.readFileSync(path.resolve(process.cwd(), dbSSL.caPath)),
          rejectUnauthorized: true,
        }
      : undefined;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl,
  });

  try {
    const [migrationRows] = await connection.query(
      `SELECT COUNT(*) AS pending
       FROM (
         SELECT '300_platform_tenant_lifecycle.sql' AS migration_name UNION ALL
         SELECT '301_subscription_billing.sql' UNION ALL
         SELECT '302_booking_payment_integrity.sql' UNION ALL
         SELECT '303_full_day_slots.sql' UNION ALL
         SELECT '304_invoice_integrity.sql' UNION ALL
         SELECT '305_invoice_payment_allocations.sql' UNION ALL
         SELECT '306_booking_payment_mode.sql' UNION ALL
         SELECT '307_subscription_collations.sql' UNION ALL
         SELECT '308_auth_session_revocation.sql'
         UNION ALL SELECT '309_invitations_subscription_policy.sql'
         UNION ALL SELECT '310_user_phone.sql'
         UNION ALL SELECT '311_tenant_upi_settings.sql'
         UNION ALL SELECT '312_tenant_schema_drift_guards.sql'
         UNION ALL SELECT '313_hall_scoped_packages.sql'
         UNION ALL SELECT '314_discount_template_tenant_scope.sql'
       ) expected
       LEFT JOIN schema_migrations sm ON sm.migration_name = expected.migration_name
       WHERE sm.migration_name IS NULL`
    );
    check(checks, 'blocker', 'Platform migrations complete', Number(migrationRows[0].pending) === 0, `pending=${migrationRows[0].pending}`);

    const [superAdminRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM users
       WHERE is_super_admin = 1 AND status = 'active'`
    );
    check(checks, 'blocker', 'Active platform owner exists', Number(superAdminRows[0].count) >= 1, `count=${superAdminRows[0].count}`);

    const [tenantRows] = await connection.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status IN ('trial', 'active', 'past_due')) AS accessible_count
       FROM tenants`
    );
    check(checks, 'blocker', 'At least two tenants exist for acceptance', Number(tenantRows[0].total) >= 2, `count=${tenantRows[0].total}`);
    check(checks, 'blocker', 'At least two accessible tenants exist', Number(tenantRows[0].accessible_count) >= 2, `count=${tenantRows[0].accessible_count || 0}`);

    const [tenantAdminRows] = await connection.query(
      `SELECT COUNT(DISTINCT tenant_id) AS tenant_count
       FROM user_tenants ut
       INNER JOIN users u ON u.id = ut.user_id
       WHERE ut.role = 'admin'
         AND u.status = 'active'
         AND ut.is_active = true`
    );
    check(checks, 'blocker', 'At least two tenants have active admins', Number(tenantAdminRows[0].tenant_count) >= 2, `count=${tenantAdminRows[0].tenant_count}`);

    const [businessConfigRows] = await connection.query(
      `SELECT COUNT(DISTINCT tenant_id) AS ready_tenants
       FROM business_config
       WHERE state_code IS NOT NULL
         AND state_code <> ''
         AND business_name IS NOT NULL
         AND business_name <> ''`
    );
    check(checks, 'warning', 'Tenant business GST config exists', Number(businessConfigRows[0].ready_tenants) >= 1, `tenants=${businessConfigRows[0].ready_tenants}`);

    const [backupRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_type = 'BASE TABLE'`
    );
    const backupDir = path.resolve(__dirname, '../../backups/database');
    const latestBackup = fs.existsSync(backupDir)
      ? fs.readdirSync(backupDir)
          .filter((name) => name.endsWith('.sql'))
          .map((name) => ({
            name,
            time: fs.statSync(path.join(backupDir, name)).mtimeMs,
            size: fs.statSync(path.join(backupDir, name)).size,
          }))
          .sort((a, b) => b.time - a.time)[0]
      : null;
    check(
      checks,
      'blocker',
      'Recent database backup file exists',
      Boolean(latestBackup && latestBackup.size > 0),
      latestBackup ? `${latestBackup.name} (${latestBackup.size} bytes)` : '<missing>'
    );
    let backupVerification = null;
    let backupVerificationError = null;
    if (latestBackup) {
      try {
        backupVerification = verifyBackup(path.join(backupDir, latestBackup.name));
      } catch (error) {
        backupVerificationError = error.message;
      }
    }
    check(
      checks,
      'blocker',
      'Latest backup checksum and manifest verify',
      Boolean(backupVerification),
      backupVerification ? backupVerification.sha256 : backupVerificationError || '<missing>'
    );
    check(
      checks,
      'warning',
      'Latest backup is portable for isolated restore',
      backupVerification?.portable_restore === true,
      backupVerification?.portable_restore === true ? 'portable_restore=true' : 'create a v2 backup'
    );
    const backupAgeHours = latestBackup
      ? (Date.now() - latestBackup.time) / (60 * 60 * 1000)
      : Infinity;
    check(
      checks,
      'warning',
      'Latest database backup is less than 26 hours old',
      backupAgeHours <= 26,
      Number.isFinite(backupAgeHours) ? `${backupAgeHours.toFixed(1)} hours` : '<missing>'
    );
    const heartbeatPath = path.join(backupDir, 'scheduler-heartbeat.json');
    let heartbeat = null;
    try {
      heartbeat = JSON.parse(fs.readFileSync(heartbeatPath, 'utf8'));
    } catch (_) {
      heartbeat = null;
    }
    const heartbeatAgeHours = heartbeat?.recorded_at
      ? (Date.now() - new Date(heartbeat.recorded_at).getTime()) / (60 * 60 * 1000)
      : Infinity;
    check(
      checks,
      'warning',
      'Scheduled backup heartbeat is successful and recent',
      heartbeat?.status === 'success' && heartbeatAgeHours <= 26,
      heartbeat ? `status=${heartbeat.status}, age=${heartbeatAgeHours.toFixed(1)} hours` : '<missing>'
    );
    check(checks, 'info', 'Base table count', true, String(backupRows[0].count));
  } finally {
    await connection.end();
  }

  const blockers = checks.filter((item) => item.level === 'blocker' && !item.pass);
  const warnings = checks.filter((item) => item.level === 'warning' && !item.pass);

  console.log(JSON.stringify({
    ok: blockers.length === 0,
    blockers: blockers.map((item) => item.name),
    warnings: warnings.map((item) => item.name),
    checks,
  }, null, 2));

  process.exitCode = blockers.length > 0 ? 2 : 0;
}

main().catch((error) => {
  console.error('Production readiness audit failed:', error.message);
  process.exitCode = 1;
});
