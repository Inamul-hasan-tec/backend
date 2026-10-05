const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { getMigrationFiles } = require('../scripts/platform_migration_inventory');

// Offline corpus review only; this scanner is not used to execute migrations.
function review(sql) {
  const findings = { quoted_semicolons: 0, quoted_double_dash: 0,
    escaped_quotes: 0, escaped_backslashes: 0, doubled_quotes: 0, executable_comments: 0,
    delimiter: false, stored_program: false, unterminated: false };
  const statements = [];
  let current = '';
  let outside = '';
  for (let i = 0; i < sql.length;) {
    if (sql.slice(i, i + 2) === '--' && /\s/.test(sql[i + 2] || ' ')) {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end;
      current += ' ';
      outside += ' ';
    } else if (sql.slice(i, i + 2) === '/*') {
      if (sql[i + 2] === '!') findings.executable_comments++;
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) { findings.unterminated = true; break; }
      i = end + 2;
      current += ' ';
      outside += ' ';
    } else if (['\'', '"', '`'].includes(sql[i])) {
      const quote = sql[i];
      current += quote;
      outside += ' ';
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === ';') findings.quoted_semicolons++;
        if (sql.slice(i, i + 2) === '--') findings.quoted_double_dash++;
        if (sql[i] === '\\' && quote !== '`') {
          if (sql[i + 1] === quote) findings.escaped_quotes++;
          if (sql[i + 1] === '\\') findings.escaped_backslashes++;
          current += sql.slice(i, i + 2);
          i += 2;
        } else if (sql[i] === quote) {
          current += sql[i++];
          if (sql[i] === quote) { findings.doubled_quotes++; current += sql[i++]; continue; }
          closed = true;
          break;
        } else { current += sql[i++]; }
      }
      if (!closed) findings.unterminated = true;
    } else if (sql[i] === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      outside += ';';
      i++;
    } else {
      current += sql[i];
      outside += sql[i++];
    }
  }
  if (current.trim()) statements.push(current.trim());
  findings.delimiter = /\bDELIMITER\b/i.test(outside);
  findings.stored_program = /\bCREATE\s+(?:DEFINER\s*=\s*[^;]+?\s+)?(?:PROCEDURE|FUNCTION|TRIGGER|EVENT)\b/i.test(outside);
  return { findings, statements };
}

const moduleFixture = { exports: {} };
const fakeRequire = id => {
  if (id === 'fs') return fs;
  if (id === 'path') return path;
  if (id === 'dotenv') return { config() {} };
  if (id === './platform_migration_inventory') return { getMigrationFiles };
  throw new Error(`Database access is forbidden in SQL review: ${id}`);
};
// Merely loading the script needs mysql2; any connection attempt still throws.
const guardedRequire = id => id === 'mysql2/promise'
  ? { createConnection() { throw new Error('Database access forbidden'); } } : fakeRequire(id);
guardedRequire.main = null;
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../scripts/run_platform_migrations.js'), 'utf8'), {
  module: moduleFixture, require: guardedRequire,
  __dirname: path.resolve(__dirname, '../scripts'),
});
const { splitSqlStatements } = moduleFixture.exports;

test('offline review detects risky syntax inside literals and executable comments', () => {
  const sample = review("SELECT 'a;b--c', 'it''s'; /*! SELECT 1 */ DELIMITER $$ CREATE PROCEDURE p() SELECT 1;");
  assert.equal(sample.findings.quoted_semicolons, 1);
  assert.equal(sample.findings.quoted_double_dash, 1);
  assert.equal(sample.findings.doubled_quotes, 1);
  assert.equal(sample.findings.executable_comments, 1);
  assert.equal(sample.findings.delimiter, true);
  assert.equal(sample.findings.stored_program, true);
});

const corpusReview = getMigrationFiles().map(file => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../migrations', file), 'utf8');
  return { file, sql, ...review(sql) };
});

for (const entry of corpusReview) {
  test(`splitter compatibility: ${entry.file}`, () => {
    assert.equal(entry.findings.delimiter, false);
    assert.equal(entry.findings.stored_program, false);
    assert.equal(entry.findings.executable_comments, 0);
    assert.equal(entry.findings.unterminated, false);
    const normalize = statement => statement.replace(/\s+/g, ' ').trim();
    assert.deepEqual(Array.from(splitSqlStatements(entry.sql), normalize), entry.statements.map(normalize));
  });
}

module.exports = { corpusReview: corpusReview.map(({ file, findings, statements }) => ({
  file, ...findings, statement_count: statements.length,
})) };
