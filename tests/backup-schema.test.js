const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { portableView, assertLocalView, verifyRestoredViews, CORE_TABLES, CORE_VIEWS } = require('../scripts/backup_schema');
const { verifyBackup } = require('../scripts/verify_database_backup');

function definition(name, select = "select `hallsync_prod`.`bookings`.`id`, 'hallsync_prod.bookings' as `literal` from `hallsync_prod`.`bookings`") {
  return `CREATE ALGORITHM=UNDEFINED DEFINER=\`production_user\`@\`localhost\` SQL SECURITY DEFINER VIEW \`${name}\` AS ${select}`;
}

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hallsync-backup-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const tables = options.tables || CORE_TABLES;
  const views = options.views || CORE_VIEWS;
  let sql = tables.map(name => `CREATE TABLE \`${name}\` (id INT);`).join('\n') + '\n';
  for (const name of views) {
    sql += `-- HallSync portable view: ${JSON.stringify(name)}\n${portableView(definition(name), 'hallsync_prod', name)}\n-- End HallSync portable view\n`;
  }
  if (options.empty) sql = '';
  const file = path.join(dir, 'backup.sql');
  fs.writeFileSync(file, sql);
  const manifest = { manifest_version: 3, database: 'hallsync_prod', backup_file: 'backup.sql',
    size_bytes: Buffer.byteLength(sql), sha256: crypto.createHash('sha256').update(sql).digest('hex'),
    base_table_count: tables.length, base_table_names: tables, view_count: views.length,
    view_names: views, portable_restore: true, view_definer_policy: 'restore_current_user', ...options.manifest };
  fs.writeFileSync(file + '.json', JSON.stringify(manifest));
  return file;
}

test('portable definitions remove database bindings and production account while preserving literals/security', () => {
  const sql = portableView(definition('booking_details'), 'hallsync_prod', 'booking_details');
  assert.match(sql, /DEFINER=CURRENT_USER SQL SECURITY DEFINER/);
  assert.doesNotMatch(sql, /`hallsync_prod`\./);
  assert.match(sql, /'hallsync_prod.bookings'/);
  assert.match(sql, /from `bookings`/);
});
test('invoker mode and check option are preserved', () => {
  const sql = definition('booking_details').replace('SECURITY DEFINER', 'SECURITY INVOKER') + ' WITH CASCADED CHECK OPTION';
  assert.match(portableView(sql, 'hallsync_prod', 'booking_details'), /SECURITY INVOKER/);
  assert.match(portableView(sql, 'hallsync_prod', 'booking_details'), /WITH CASCADED CHECK OPTION;/);
});
test('external database dependencies fail closed', () => {
  assert.throws(() => assertLocalView('select count(*) from (((`hallsync_prod`.`bookings` b)))', 'hallsync_restore_drill'), /external database/);
  assert.throws(() => portableView(definition('booking_details', 'select * from `other_db`.`bookings`'), 'hallsync_prod', 'booking_details'), /external database/);
  assert.throws(() => assertLocalView('select `hallsync_prod`.`bookings`.`id` from `hallsync_restore_drill`.`bookings`', 'hallsync_restore_drill'), /external database/);
  assert.doesNotThrow(() => assertLocalView('select `hallsync_restore_drill`.`bookings`.`id` from `hallsync_restore_drill`.`bookings`', 'hallsync_restore_drill'));
});
test('unsupported definer and mismatched view names fail', () => {
  assert.throws(() => portableView(definition('booking_details').replace('DEFINER=`production_user`@`localhost`', ''), 'hallsync_prod', 'booking_details'), /definer/);
  assert.throws(() => portableView(definition('wrong'), 'hallsync_prod', 'booking_details'), /name mismatch/);
});
test('schema-complete backup verifies exact names and counts', t => {
  const result = verifyBackup(fixture(t));
  assert.equal(result.base_table_count, CORE_TABLES.length);
  assert.equal(result.view_count, 2);
  assert.deepEqual(result.view_names, [...CORE_VIEWS].sort());
});
test('missing view is rejected even when checksum and manifest match', t => {
  assert.throws(() => verifyBackup(fixture(t, { views: ['booking_details'] })), /missing required view: dashboard_stats/);
});
test('missing core table and incorrect counts are rejected', t => {
  assert.throws(() => verifyBackup(fixture(t, { tables: CORE_TABLES.slice(1) })), /missing core table: tenants/);
  assert.throws(() => verifyBackup(fixture(t, { manifest: { base_table_count: 41, view_count: 3 } })), /inventory mismatch/);
});
test('legacy table-only manifests no longer claim schema completeness', t => {
  assert.throws(() => verifyBackup(fixture(t, { manifest: { manifest_version: 2 } })), /v3 backup required/);
});
test('empty backups and corruption are rejected', t => {
  assert.throws(() => verifyBackup(fixture(t, { empty: true })), /empty backup/);
  const file = fixture(t);
  fs.appendFileSync(file, '\ncorruption');
  assert.throws(() => verifyBackup(file), /checksum mismatch/);
});

function restoredMock(options = {}) {
  const queries = [];
  return { queries, async query(sql) {
    queries.push(sql);
    if (sql.includes('information_schema.views')) return [CORE_VIEWS.map(name => ({ name,
      definition: `select count(*) from \`${options.sourceBound ? 'hallsync_prod' : 'hallsync_restore_drill'}\`.\`bookings\``,
      [/\bDEFINER\s+AS\s+definer\b/i.test(sql) ? 'definer' : 'DEFINER']:
        options.wrongDefiner ? 'production@localhost' : 'restore@localhost' }))];
    if (sql.includes('CURRENT_USER')) return [[{ account: 'restore@localhost' }]];
    if (options.selectFails) throw new Error('Invalid view');
    return [[]];
  } };
}
test('mysql2 uppercase DEFINER metadata requires an explicit lowercase alias', async () => {
  const connection = restoredMock();
  const [unaliased] = await connection.query(
    'SELECT table_name AS name, view_definition AS definition, definer FROM information_schema.views WHERE table_schema = DATABASE()'
  );
  assert.equal(unaliased[0].DEFINER, 'restore@localhost');
  assert.equal(unaliased[0].definer, undefined);
  const result = await verifyRestoredViews(connection, 'hallsync_restore_drill');
  assert.equal(result.checks.length, CORE_VIEWS.length);
  assert.ok(result.checks.every(check => check.definer_ok && check.select_ok && check.error === null));
});
test('restore checks query both required views using the restore database and account', async () => {
  const connection = restoredMock();
  const result = await verifyRestoredViews(connection, 'hallsync_restore_drill');
  assert.deepEqual(result.names, CORE_VIEWS);
  assert.ok(result.checks.every(check => check.local_dependencies && check.definer_ok && check.select_ok));
  for (const name of CORE_VIEWS) assert.ok(connection.queries.includes(`SELECT * FROM \`${name}\` LIMIT 1`));
});
test('restore rejects production-bound views before querying their data', async () => {
  const connection = restoredMock({ sourceBound: true });
  const result = await verifyRestoredViews(connection, 'hallsync_restore_drill');
  assert.ok(result.checks.every(check => !check.local_dependencies && !check.select_ok));
  assert.ok(!connection.queries.some(sql => sql.startsWith('SELECT *')));
});
test('restore reports definer and SELECT failures', async () => {
  const definer = await verifyRestoredViews(restoredMock({ wrongDefiner: true }), 'hallsync_restore_drill');
  assert.ok(definer.checks.every(check => /definer/.test(check.error)));
  const select = await verifyRestoredViews(restoredMock({ selectFails: true }), 'hallsync_restore_drill');
  assert.ok(select.checks.every(check => check.definer_ok && !check.select_ok && check.error === 'Invalid view'));
});
