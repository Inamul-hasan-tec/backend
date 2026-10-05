const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { getMigrationFiles } = require('../scripts/platform_migration_inventory');

const scripts = path.resolve(__dirname, '../scripts');
function loadScript(name, overrides, options = {}) {
  const module = { exports: {} };
  const fakeRequire = id => {
    if (!Object.hasOwn(overrides, id)) throw new Error(`Unexpected test dependency: ${id}`);
    return overrides[id];
  };
  fakeRequire.main = null;
  const testProcess = { env: { NODE_ENV: 'test', DB_NAME: 'offline_fixture', ...options.env }, cwd: () => scripts };
  const source = fs.readFileSync(path.join(scripts, name), 'utf8') + (options.captureSchema
    ? '\nmodule.exports.testSchema = { requiredTables, requiredColumns, requiredColumnCollations };' : '');
  vm.runInNewContext(source, {
    require: fakeRequire, module, __dirname: scripts,
    process: testProcess,
    console: { log() {}, error() {} },
  }, { filename: name });
  return { ...module.exports, testProcess };
}

function runnerFixture(files, failure, applied = []) {
  const calls = [];
  const recorded = new Set(applied);
  let closed = false;
  const connection = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT migration_name')) return [recorded.has(values[0]) ? [{ migration_name: values[0] }] : []];
      if (sql.startsWith('INSERT INTO schema_migrations')) recorded.add(values[0]);
      if (sql.startsWith('ALTER TABLE') && failure) throw failure;
      return [[]];
    },
    async end() { closed = true; },
  };
  const runner = loadScript('run_platform_migrations.js', {
    fs: { readFileSync: () => 'ALTER TABLE example ADD UNIQUE KEY unique_value (value); SELECT 1;' },
    path,
    'mysql2/promise': { createConnection: async () => connection },
    dotenv: { config() {} },
    './platform_migration_inventory': { getMigrationFiles: () => files },
  });
  return { runner, calls, recorded, get closed() { return closed; } };
}

for (const [code, message] of [
  ['ER_DUP_ENTRY', 'Duplicate entry for unique key'],
  ['ER_DUP_KEYNAME', 'Duplicate key name'],
  ['ER_TABLE_EXISTS_ERROR', 'Table already exists'],
  ['ER_NO_REFERENCED_ROW_2', 'Cannot add or update a child row: a foreign key constraint fails'],
]) {
  test(`${code} stops migration without recording success or continuing`, async () => {
    const failure = Object.assign(new Error(message), { code });
    const fixture = runnerFixture(['312_first.sql', '313_next.sql'], failure);
    await assert.rejects(fixture.runner.run(), error => error === failure);
    assert.equal(fixture.recorded.size, 0);
    assert.ok(!fixture.calls.some(call => call.sql.startsWith('INSERT INTO schema_migrations')));
    assert.ok(!fixture.calls.some(call => call.values?.[0] === '313_next.sql'));
    assert.ok(fixture.closed);
  });
}

test('inventory includes every platform SQL file, both duplicate-prefix pairs, and no historical files', () => {
  const files = getMigrationFiles();
  const raw = fs.readdirSync(path.resolve(scripts, '../migrations'))
    .filter(file => /^3\d{2}_.*\.sql$/.test(file));
  assert.deepEqual(new Set(files), new Set(raw));
  assert.equal(files.length, 29);
  assert.deepEqual(files.filter(file => file.startsWith('312_')), [
    '312_invoice_tax_mode.sql', '312_tenant_schema_drift_guards.sql',
  ]);
  assert.deepEqual(files.filter(file => file.startsWith('313_')), [
    '313_hall_scoped_packages.sql', '313_invoice_sequences_and_gst_status.sql',
  ]);
  assert.ok(files.every(file => /^3\d{2}_/.test(file)));
  for (const script of ['run_platform_migrations.js', 'audit_staging_schema.js', 'production_readiness_audit.js']) {
    const source = fs.readFileSync(path.join(scripts, script), 'utf8');
    assert.match(source, /require\('\.\/platform_migration_inventory'\)/);
    assert.match(source, /getMigrationFiles\(\)/);
  }
});

test('tracker identity uses complete filenames and independently skips/applies duplicate prefixes', async () => {
  const files = getMigrationFiles().filter(file => /^(312|313)_/.test(file));
  const fixture = runnerFixture(files, null, [files[0], files[2]]);
  await fixture.runner.run();
  assert.deepEqual([...fixture.recorded].sort(), [...files].sort());
  assert.deepEqual(fixture.calls.filter(call => call.sql.startsWith('INSERT INTO schema_migrations'))
    .map(call => call.values[0]), [files[1], files[3]]);
});

function windowFixture(exitCodes) {
  const calls = [];
  const window = loadScript('run_production_migration_window.js', {
    child_process: { spawn(command, args, options) {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('close', exitCodes[calls.length - 1]));
      return child;
    } },
  });
  return { window, calls };
}

test('failed production preflight prevents backup and migration children', async () => {
  for (const exitCode of [1, 2, null]) {
    const fixture = windowFixture([exitCode]);
    await assert.rejects(fixture.window.main(), /Pre-migration audit failed/);
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual([...fixture.calls[0].args], ['scripts/audit_staging_schema.js']);
    assert.equal(fixture.calls[0].options.env.HALL_SYNC_PRODUCTION_TARGET, 'true');
    assert.equal(fixture.calls[0].options.env.MIGRATION_AUDIT_MODE, 'pre');
  }
});

test('successful preflight preserves backup/migration/post-audit order and production guard', async () => {
  const fixture = windowFixture([0, 0, 0, 0]);
  await fixture.window.main();
  assert.deepEqual(fixture.calls.map(call => call.args[0]), [
    'scripts/audit_staging_schema.js', 'scripts/backup_database.js',
    'scripts/run_platform_migrations.js', 'scripts/audit_staging_schema.js',
  ]);
  assert.equal(fixture.calls[2].options.env.ALLOW_PRODUCTION_MIGRATIONS, 'true');
  assert.equal(fixture.calls[3].options.env.MIGRATION_AUDIT_MODE, 'post');
});

test('failed backup also prevents migration execution', async () => {
  const fixture = windowFixture([0, 1]);
  await assert.rejects(fixture.window.main(), /Database backup failed/);
  assert.equal(fixture.calls.length, 2);
});

test('migration failure prevents postflight and postflight failure rejects the window', async () => {
  const migration = windowFixture([0, 0, 1]);
  await assert.rejects(migration.window.main(), /Apply platform migrations failed/);
  assert.equal(migration.calls.length, 3);
  const post = windowFixture([0, 0, 0, 2]);
  await assert.rejects(post.window.main(), /Post-migration audit failed/);
  assert.equal(post.calls.length, 4);
});

function auditFixture(options = {}) {
  let audit;
  let connected = false;
  let closed = false;
  const connection = { async query(sql) {
    const schema = audit.testSchema;
    if (sql.startsWith('SELECT DATABASE()')) return [[{ db: options.wrongIdentity ? 'unexpected_db' : 'offline_fixture' }]];
    if (sql.includes('information_schema.tables')) return [[...new Set([
      'payments', ...schema.requiredTables, ...Object.keys(schema.requiredColumns),
      ...Object.keys(schema.requiredColumnCollations),
    ])].filter(name => !options.missingTable || name !== 'schema_migrations').map(table_name => ({ table_name }))];
    if (sql.includes('information_schema.columns')) {
      const rows = [];
      for (const [table_name, names] of Object.entries(schema.requiredColumns)) {
        for (const column_name of names) rows.push({ table_name, column_name });
      }
      for (const [table_name, columns] of Object.entries(schema.requiredColumnCollations)) {
        for (const [column_name, collation_name] of Object.entries(columns)) rows.push({ table_name, column_name,
          collation_name: options.invalidCollation ? 'latin1_swedish_ci' : collation_name });
      }
      return [rows.filter(row => !options.missingColumn || row.column_name !== 'auth_version')];
    }
    if (sql.includes('FROM schema_migrations')) return [(options.allApplied ? getMigrationFiles() : []).map(migration_name => ({ migration_name }))];
    if (sql.includes('FROM invoices')) return [[{ status: options.invalidInvoice ? 'unknown_status' : 'issued', count: 1 }]];
    if (sql.includes('FROM payments')) return [options.duplicatePayment ? [{ tenant_id: 1, transaction_id: 'duplicate', count: 2 }] : []];
    throw new Error(`Unexpected offline audit query: ${sql}`);
  }, async end() { closed = true; } };
  audit = loadScript('audit_staging_schema.js', {
    fs, path, dotenv: { config() {} },
    'mysql2/promise': { createConnection: async () => { connected = true; return connection; } },
    './platform_migration_inventory': { getMigrationFiles },
  }, { captureSchema: true, env: {
    NODE_ENV: 'production', HALL_SYNC_PRODUCTION_TARGET: 'true',
    ...(options.mode === undefined ? {} : { MIGRATION_AUDIT_MODE: options.mode }),
    ...options.env,
  } });
  return { audit, get connected() { return connected; }, get closed() { return closed; } };
}

test('PRE allows pending inventory; POST and default audit require none pending', async () => {
  const pre = auditFixture({ mode: 'pre' });
  const report = await pre.audit.main();
  assert.equal(report.ok, true);
  assert.equal(report.audit_mode, 'pre');
  assert.equal(report.pending_platform_migrations.length, 29);
  assert.equal(report.expected_platform_migrations.length, 29);
  assert.equal(pre.audit.testProcess.exitCode, 0);
  assert.ok(pre.closed);
  for (const mode of ['post', undefined]) {
    const post = auditFixture({ mode });
    assert.equal((await post.audit.main()).ok, false);
    assert.equal(post.audit.testProcess.exitCode, 2);
  }
  const complete = auditFixture({ mode: 'post', allApplied: true });
  assert.equal((await complete.audit.main()).ok, true);
});

test('PRE retains schema and data blockers', async () => {
  for (const blocker of ['missingTable', 'missingColumn', 'invalidCollation', 'invalidInvoice', 'duplicatePayment']) {
    const fixture = auditFixture({ mode: 'pre', [blocker]: true });
    assert.equal((await fixture.audit.main()).ok, false, blocker);
    assert.equal(fixture.audit.testProcess.exitCode, 2, blocker);
  }
});

test('audit rejects unknown modes and mismatched DB identity, and preserves production protections', async () => {
  const invalid = auditFixture({ mode: 'unknown' });
  await assert.rejects(invalid.audit.main(), /must be pre or post/);
  assert.equal(invalid.connected, false);
  const identity = auditFixture({ mode: 'pre', wrongIdentity: true });
  await assert.rejects(identity.audit.main(), /does not match configured DB_NAME/);
  assert.ok(identity.closed);
  const unconfirmed = auditFixture({ mode: 'pre', env: { HALL_SYNC_PRODUCTION_TARGET: 'false' } });
  assert.equal((await unconfirmed.audit.main()).ok, false);
});
