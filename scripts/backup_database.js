const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { backupDir: resolveBackupDir } = require('./backup_paths');
const { quoteIdentifier, portableView, schemaInventory, sameNames, CORE_TABLES, CORE_VIEWS } = require('./backup_schema');
const { finished } = require('stream/promises');

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


async function getSchema({ host, port, user, password, database }) {
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
      `SELECT table_name AS name, table_type AS type
       FROM information_schema.tables
       WHERE table_schema = DATABASE() ORDER BY table_name`
    );
    const tables = rows.filter(row => row.type === 'BASE TABLE').map(row => row.name);
    const views = [];
    for (const row of rows.filter(row => row.type === 'VIEW')) {
      const [definition] = await connection.query(`SHOW CREATE VIEW ${quoteIdentifier(row.name)}`);
      const info = definition[0];
      if (!/^[a-zA-Z0-9_]+$/.test(info.character_set_client) || !/^[a-zA-Z0-9_]+$/.test(info.collation_connection)) {
        throw new Error(`Invalid view character set metadata: ${row.name}`);
      }
      views.push({ name: row.name, sql: portableView(info['Create View'], database, row.name),
        character_set_client: info.character_set_client, collation_connection: info.collation_connection });
    }
    for (const name of CORE_TABLES) if (!tables.includes(name)) throw new Error(`Missing core table: ${name}`);
    for (const name of CORE_VIEWS) if (!views.some(v => v.name === name)) throw new Error(`Missing core view: ${name}`);
    // Place dependent views after the views they reference. SHOW CREATE qualifies dependencies.
    const ordered = [];
    const pending = [...views];
    while (pending.length) {
      const index = pending.findIndex(view => !pending.some(other => other !== view &&
        new RegExp('\\b(?:FROM|JOIN)\\s+' + quoteIdentifier(other.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(view.sql)));
      if (index < 0) throw new Error('Unsupported cyclic view dependencies');
      ordered.push(...pending.splice(index, 1));
    }
    return { tables, views: ordered };
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

  const backupDir = resolveBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });

  const fileName = `${database}-backup-${timestamp()}.sql`;
  const backupPath = path.join(backupDir, fileName);
  const schema = await getSchema({ host, port, user, password, database });
  const views = schema.views.map(view => view.name);
  const output = fs.createWriteStream(backupPath, { flags: 'wx', mode: 0o600 });

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
    '--no-tablespaces',
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

    child.stdout.pipe(output, { end: false });
    child.on('error', reject);
    output.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        output.destroy();
        fs.rmSync(backupPath, { force: true });
        reject(new Error(`mysqldump exited with code ${code}`));
      }
    });
  });

  // Append live definitions instead of mysqldump's source-bound view placeholders/definers.
  for (const view of schema.views) {
    output.write(`\nSET @hs_view_charset = @@character_set_client;\nSET @hs_view_collation = @@collation_connection;\n`);
    output.write(`SET character_set_client = ${view.character_set_client};\nSET collation_connection = ${view.collation_connection};\n`);
    output.write(`-- HallSync portable view: ${JSON.stringify(view.name)}\n${view.sql}\n-- End HallSync portable view\n`);
    output.write('SET character_set_client = @hs_view_charset;\nSET collation_connection = @hs_view_collation;\n');
  }
  output.end();
  await finished(output);

  const stat = fs.statSync(backupPath);
  if (stat.size === 0) {
    throw new Error(`Backup file was created but is empty: ${backupPath}`);
  }

  const inventory = schemaInventory(fs.readFileSync(backupPath, 'utf8'));
  if (!sameNames(inventory.tables, schema.tables) || !sameNames(inventory.views, views)) {
    throw new Error('Dump schema does not match source inventory');
  }
  const tableCount = schema.tables.length;
  const checksum = crypto
    .createHash('sha256')
    .update(fs.readFileSync(backupPath))
    .digest('hex');
  const manifestPath = `${backupPath}.json`;
  const manifest = {
    manifest_version: 3,
    created_at: new Date().toISOString(),
    database,
    backup_file: fileName,
    size_bytes: stat.size,
    sha256: checksum,
    base_table_count: tableCount,
    base_table_names: schema.tables,
    view_count: views.length,
    view_names: views,
    view_definer_policy: 'restore_current_user',
    ignored_views: [],
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
        view_count: views.length,
        view_names: views,
        ignored_views: [],
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
