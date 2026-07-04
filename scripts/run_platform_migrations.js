const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const migrationFiles = [
  '300_platform_tenant_lifecycle.sql',
  '301_subscription_billing.sql',
  '302_booking_payment_integrity.sql',
  '303_full_day_slots.sql',
  '304_invoice_integrity.sql',
  '305_invoice_payment_allocations.sql',
  '306_booking_payment_mode.sql',
  '307_subscription_collations.sql',
  '308_auth_session_revocation.sql',
  '309_invitations_subscription_policy.sql',
  '310_user_phone.sql',
  '311_tenant_upi_settings.sql',
  '312_tenant_schema_drift_guards.sql',
];

async function run() {
  const looksProduction =
    process.env.NODE_ENV === 'production' ||
    (process.env.DB_NAME || '').toLowerCase() === 'defaultdb';
  if (
    looksProduction &&
    process.env.ALLOW_PRODUCTION_MIGRATIONS !== 'true'
  ) {
    throw new Error(
      [
        'Refusing to run platform migrations against a production/default database.',
        'Use a disposable staging database, or set ALLOW_PRODUCTION_MIGRATIONS=true only after backup and approval.',
      ].join(' ')
    );
  }

  const ssl =
    process.env.DB_SSL === 'true'
      ? {
          ca: fs.readFileSync(
            path.resolve(
              process.cwd(),
              process.env.DB_SSL_CA_PATH || 'config/aiven-ca.pem'
            )
          ),
          rejectUnauthorized: true,
        }
      : undefined;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    ssl,
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migrationFile of migrationFiles) {
      const [rows] = await connection.query(
        'SELECT migration_name FROM schema_migrations WHERE migration_name = ?',
        [migrationFile]
      );
      if (rows.length > 0) {
        console.log(`Skipping ${migrationFile}`);
        continue;
      }

      const sql = fs.readFileSync(
        path.join(__dirname, '../migrations', migrationFile),
        'utf8'
      );
      console.log(`Running ${migrationFile}`);
      await connection.query(sql);
      await connection.query(
        'INSERT INTO schema_migrations (migration_name) VALUES (?)',
        [migrationFile]
      );
    }

    console.log('Platform migrations completed');
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error('Platform migration failed:', error.message);
  process.exitCode = 1;
});
