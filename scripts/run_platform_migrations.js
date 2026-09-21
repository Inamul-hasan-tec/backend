const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Dynamically discover and sort all migration files in migrations/ directory
 */
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir);
  
  // Filter for platform SQL migration files starting with 3xx (e.g. 300_xxx.sql, 322_xxx.sql)
  const sqlFiles = files.filter(f => f.endsWith('.sql') && /^3\d{2}_/.test(f));

  // Sort numerically by prefix number (e.g. 300 < 301 < ... < 320)
  sqlFiles.sort((a, b) => {
    const numA = parseInt(a.split('_')[0], 10) || 0;
    const numB = parseInt(b.split('_')[0], 10) || 0;
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  return sqlFiles;
}

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
        try {
          await connection.query(statement);
        } catch (stmtErr) {
          if (!stmtErr.message.includes('already exists') && !stmtErr.message.includes('Duplicate')) {
            throw stmtErr;
          }
        }
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

run().catch((error) => {
  console.error('❌ Platform migration failed:', error.message);
  process.exitCode = 1;
});
