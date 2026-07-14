const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { verifyBackup } = require('./verify_database_backup');

dotenv.config({ path: path.join(__dirname, '../.env') });

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) throw new Error(`${name} is required`);
  return String(value).trim();
}

function restoreConfig() {
  const database = required('RESTORE_DB_NAME');
  if (!/^[A-Za-z0-9_-]+$/.test(database)) {
    throw new Error('RESTORE_DB_NAME contains unsupported characters');
  }
  if (database === process.env.DB_NAME) {
    throw new Error('Restore target must not be the production/source database');
  }
  if (process.env.RESTORE_DRILL_CONFIRM !== 'true') {
    throw new Error('Set RESTORE_DRILL_CONFIRM=true to authorize the isolated restore drill');
  }

  return {
    host: process.env.RESTORE_DB_HOST || required('DB_HOST'),
    port: Number(process.env.RESTORE_DB_PORT || process.env.DB_PORT || 3306),
    user: process.env.RESTORE_DB_USER || required('DB_USER'),
    password: process.env.RESTORE_DB_PASSWORD || required('DB_PASSWORD'),
    database,
  };
}

function sslConfig() {
  const enabled = String(process.env.RESTORE_DB_SSL || process.env.DB_SSL) === 'true';
  if (!enabled) return undefined;
  const caPath = path.resolve(
    process.cwd(),
    process.env.RESTORE_DB_SSL_CA_PATH || process.env.DB_SSL_CA_PATH || 'config/aiven-ca.pem'
  );
  return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
}

function restoreDump(config, backupPath) {
  const args = [
    '--host', config.host,
    '--port', String(config.port),
    '--user', config.user,
    '--database', config.database,
  ];
  if (sslConfig()) args.push('--ssl-mode=REQUIRED');

  return new Promise((resolve, reject) => {
    const child = spawn('mysql', args, {
      stdio: ['pipe', 'inherit', 'inherit'],
      env: { ...process.env, MYSQL_PWD: config.password },
    });
    const source = fs.createReadStream(backupPath);
    source.on('error', reject);
    child.stdin.on('error', (error) => {
      // mysql can close stdin before the dump stream finishes after reporting
      // its real SQL error. Let the child exit code remain the useful failure.
      if (error.code !== 'EPIPE') reject(error);
    });
    source.pipe(child.stdin);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysql restore exited with code ${code}`));
    });
  });
}

async function main() {
  const config = restoreConfig();
  const backupPath = path.resolve(required('BACKUP_FILE'));
  const verification = verifyBackup(backupPath);
  if (!verification.portable_restore) {
    throw new Error('Backup is not marked portable_restore=true; create a new v2 backup first');
  }

  const connection = await mysql.createConnection({
    ...config,
    ssl: sslConfig(),
  });

  try {
    const [beforeRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_type = 'BASE TABLE'`
    );
    if (Number(beforeRows[0].count) !== 0) {
      throw new Error(`Restore target must be empty; found ${beforeRows[0].count} base tables`);
    }
  } finally {
    await connection.end();
  }

  await restoreDump(config, backupPath);

  const restored = await mysql.createConnection({ ...config, ssl: sslConfig() });
  let tableCount;
  let criticalTables;
  let migrationCount;
  try {
    const [tableRows] = await restored.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_type = 'BASE TABLE'`
    );
    tableCount = Number(tableRows[0].count);

    const expectedTables = [
      'tenants', 'users', 'user_tenants', 'customers', 'halls', 'packages',
      'slots', 'bookings', 'payments', 'invoices', 'schema_migrations',
    ];
    const placeholders = expectedTables.map(() => '?').join(', ');
    const [criticalRows] = await restored.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN (${placeholders})`,
      expectedTables
    );
    const found = new Set(criticalRows.map((row) => row.TABLE_NAME || row.table_name));
    criticalTables = expectedTables.map((name) => ({ name, present: found.has(name) }));
    const [migrationRows] = await restored.query('SELECT COUNT(*) AS count FROM schema_migrations');
    migrationCount = Number(migrationRows[0].count);
  } finally {
    await restored.end();
  }

  const missingCritical = criticalTables.filter((table) => !table.present);
  const ok = tableCount === verification.base_table_count && missingCritical.length === 0;
  const report = {
    ok,
    completed_at: new Date().toISOString(),
    source_database: verification.database,
    restore_database: config.database,
    backup_file: path.basename(backupPath),
    sha256: verification.sha256,
    expected_base_table_count: verification.base_table_count,
    restored_base_table_count: tableCount,
    schema_migration_count: migrationCount,
    critical_tables: criticalTables,
  };

  const reportDir = path.resolve(__dirname, '../../backups/restore-drills');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `restore-drill-${Date.now()}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ ...report, report_path: reportPath }, null, 2));
  if (!ok) process.exitCode = 2;
}

main().catch((error) => {
  console.error('Restore drill failed:', error.message);
  process.exitCode = 1;
});
