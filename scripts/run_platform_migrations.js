const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { getMigrationFiles } = require('./platform_migration_inventory');

function splitSqlStatements(sql) {
  // Remove multi-line comments /* ... */
  let cleanedSql = sql.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove single-line comments (-- ...)
  const lines = cleanedSql
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('--')) return '';
      // Remove inline trailing comment if present and not inside string
      const commentIdx = line.indexOf('--');
      if (commentIdx !== -1) {
        // Simple check if -- is preceded by space or start
        return line.substring(0, commentIdx);
      }
      return line;
    });
  cleanedSql = lines.join('\n');

  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < cleanedSql.length; i++) {
    const char = cleanedSql[i];
    if (!inString && (char === "'" || char === '"' || char === '`')) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar && cleanedSql[i - 1] !== '\\') {
      inString = false;
      stringChar = '';
      current += char;
    } else if (!inString && char === ';') {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }
  return statements;
}

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

    const migrationFiles = getMigrationFiles();
    console.log(`Discovered ${migrationFiles.length} migration file(s) in migrations directory.`);

    let executedCount = 0;
    let skippedCount = 0;

    for (const migrationFile of migrationFiles) {
      const [rows] = await connection.query(
        'SELECT migration_name FROM schema_migrations WHERE migration_name = ?',
        [migrationFile]
      );
      if (rows.length > 0) {
        skippedCount++;
        continue;
      }

      const sqlPath = path.join(__dirname, '../migrations', migrationFile);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`🚀 Running migration: ${migrationFile}`);

      const statements = splitSqlStatements(sql);
      for (const statement of statements) {
        if (!statement || statement.startsWith('--')) continue;
        await connection.query(statement);
      }

      await connection.query(
        'INSERT INTO schema_migrations (migration_name) VALUES (?)',
        [migrationFile]
      );
      executedCount++;
    }

    console.log(`✅ Platform migrations completed: ${executedCount} executed, ${skippedCount} skipped.`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('❌ Platform migration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { run, splitSqlStatements };
