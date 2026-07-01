const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.join(__dirname, '../.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for database backup`);
  }
  return value;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function databaseSSL() {
  if (process.env.DB_SSL !== 'true') return undefined;

  const caPath = path.resolve(
    process.cwd(),
    process.env.DB_SSL_CA_PATH || 'config/aiven-ca.pem'
  );
  return {
    ca: fs.readFileSync(caPath),
    rejectUnauthorized: true,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio || ['ignore', 'pipe', 'inherit'],
      env: options.env || process.env,
    });

    let stdout = '';
    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function getViewNames({ host, port, user, password, database }) {
  const connection = await mysql.createConnection({
    host,
    port: Number(port),
    user,
    password,
    database,
    ssl: databaseSSL(),
  });

  try {
    const [rows] = await connection.query(
      `SELECT table_name
       FROM information_schema.views
       WHERE table_schema = DATABASE()`
    );
    return rows.map((row) => row.TABLE_NAME || row.table_name);
  } finally {
    await connection.end();
  }
}

async function getTableCount({ host, port, user, password, database }) {
  const connection = await mysql.createConnection({
    host,
    port: Number(port),
    user,
    password,
    database,
    ssl: databaseSSL(),
  });

  try {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_type = 'BASE TABLE'`
    );
    return Number(rows[0].table_count);
  } finally {
    await connection.end();
  }
}

async function main() {
  const host = required('DB_HOST');
  const port = process.env.DB_PORT || '3306';
  const user = required('DB_USER');
  const password = required('DB_PASSWORD');
  const database = required('DB_NAME');

  const backupDir = path.resolve(__dirname, '../../backups/database');
  fs.mkdirSync(backupDir, { recursive: true });

  const fileName = `${database}-backup-${timestamp()}.sql`;
  const backupPath = path.join(backupDir, fileName);
  const output = fs.createWriteStream(backupPath, { flags: 'wx' });
  const views = await getViewNames({ host, port, user, password, database });

  const args = [
    '--host',
    host,
    '--port',
    String(port),
    '--user',
    user,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    '--events',
    '--set-gtid-purged=OFF',
  ];

  for (const view of views) {
    args.push(`--ignore-table=${database}.${view}`);
  }

  if (process.env.DB_SSL === 'true') {
    args.push('--ssl-mode=REQUIRED');
  }

  // A positional database argument produces a portable dump without embedded
  // CREATE DATABASE or USE statements, making isolated restore drills safe.
  args.push(database);

  await new Promise((resolve, reject) => {
    const child = spawn('mysqldump', args, {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: {
        ...process.env,
        MYSQL_PWD: password,
      },
    });

    child.stdout.pipe(output);
    child.on('error', reject);
    output.on('error', reject);
    child.on('close', (code) => {
      output.end();
      if (code === 0) {
        resolve();
      } else {
        fs.rmSync(backupPath, { force: true });
        reject(new Error(`mysqldump exited with code ${code}`));
      }
    });
  });

  const stat = fs.statSync(backupPath);
  if (stat.size === 0) {
    throw new Error(`Backup file was created but is empty: ${backupPath}`);
  }

  const tableCount = await getTableCount({ host, port, user, password, database });
  const checksum = crypto
    .createHash('sha256')
    .update(fs.readFileSync(backupPath))
    .digest('hex');
  const manifestPath = `${backupPath}.json`;
  const manifest = {
    manifest_version: 2,
    created_at: new Date().toISOString(),
    database,
    backup_file: fileName,
    size_bytes: stat.size,
    sha256: checksum,
    base_table_count: tableCount,
    ignored_views: views,
    portable_restore: true,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        backup_path: backupPath,
        size_bytes: stat.size,
        sha256: checksum,
        manifest_path: manifestPath,
        base_table_count: tableCount,
        ignored_views: views,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Database backup failed:', error.message);
  process.exitCode = 1;
});
