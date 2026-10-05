const CORE_TABLES = ['tenants', 'users', 'user_tenants', 'customers', 'halls',
  'packages', 'slots', 'bookings', 'payments', 'invoices', 'schema_migrations'];
const CORE_VIEWS = ['booking_details', 'dashboard_stats'];

function quoteIdentifier(name) {
  return '`' + name.replace(/`/g, '``') + '`';
}

// Tokenize identifiers separately from literals so schema rewriting never changes data.
function tokens(sql) {
  const result = [];
  const pattern = /\s+|--[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|''|[^'\\])*'|"(?:\\.|""|[^"\\])*"|`(?:``|[^`])*`|[A-Za-z_][A-Za-z0-9_$]*|./g;
  for (const match of sql.matchAll(pattern)) {
    const raw = match[0];
    const identifier = raw.startsWith('`') ? raw.slice(1, -1).replace(/``/g, '`')
      : /^[A-Za-z_][A-Za-z0-9_$]*$/.test(raw) ? raw : null;
    result.push({ raw, identifier });
  }
  return result;
}

function significant(sql) {
  return tokens(sql).filter(t => !/^\s|^--|^\/\*/.test(t.raw));
}

function assertLocalView(sql, database) {
  const list = significant(sql);
  for (let i = 0; i < list.length; i++) {
    // Three-part column references and qualified FROM/JOIN targets must use the target DB.
    const threePart = list[i].identifier && list[i + 1]?.raw === '.' &&
      list[i + 2]?.identifier && list[i + 3]?.raw === '.';
    let previous = i - 1;
    while (list[previous]?.raw === '(') previous--;
    const tableTarget = /^(FROM|JOIN)$/i.test(list[previous]?.identifier || '') &&
      list[i].identifier && list[i + 1]?.raw === '.';
    if ((threePart || tableTarget) && list[i].identifier.toLowerCase() !== database.toLowerCase()) {
      throw new Error(`View references external database: ${list[i].identifier}`);
    }
  }
}

function portableView(sql, sourceDatabase, name) {
  assertLocalView(sql, sourceDatabase);
  const list = tokens(sql);
  const meaningful = list.map((t, i) => ({ ...t, index: i }))
    .filter(t => !/^\s|^--|^\/\*/.test(t.raw));
  const removed = new Set();
  for (let i = 0; i < meaningful.length - 1; i++) {
    if (meaningful[i].identifier?.toLowerCase() === sourceDatabase.toLowerCase() && meaningful[i + 1].raw === '.') {
      for (let j = meaningful[i].index; j <= meaningful[i + 1].index; j++) removed.add(j);
    }
  }
  let portable = list.filter((_, i) => !removed.has(i)).map(t => t.raw).join('');
  const definer = /\bDEFINER\s*=\s*`(?:``|[^`])*`\s*@\s*`(?:``|[^`])*`/i;
  if (!definer.test(portable)) throw new Error(`Unsupported SHOW CREATE VIEW definer: ${name}`);
  portable = portable.replace(definer, 'DEFINER=CURRENT_USER');
  if (!/^CREATE\s+(?:ALGORITHM\s*=\s*\w+\s+)?DEFINER=CURRENT_USER\s+SQL\s+SECURITY\s+(?:DEFINER|INVOKER)\s+VIEW\s+/i.test(portable)) {
    throw new Error(`Unsupported SHOW CREATE VIEW format: ${name}`);
  }
  const actual = significant(portable);
  const viewIndex = actual.findIndex(t => /^VIEW$/i.test(t.identifier || ''));
  if (actual[viewIndex + 1]?.identifier !== name) throw new Error('View name mismatch');
  return portable.replace(/;\s*$/, '') + ';';
}

function viewBlocks(sql) {
  return [...sql.matchAll(/^-- HallSync portable view: (.+)\n([\s\S]*?)^-- End HallSync portable view\s*$/gm)]
    .map(match => ({ name: JSON.parse(match[1]), sql: match[2].trim() }));
}

function schemaInventory(sql) {
  const tables = [...sql.matchAll(/^CREATE TABLE(?: IF NOT EXISTS)? `((?:``|[^`])+)`/gm)]
    .map(match => match[1].replace(/``/g, '`')).sort();
  const views = viewBlocks(sql);
  for (const view of views) {
    const list = significant(view.sql);
    const index = list.findIndex(t => /^VIEW$/i.test(t.identifier || ''));
    if (list[index + 1]?.identifier !== view.name || !/DEFINER=CURRENT_USER\b/.test(view.sql)) {
      throw new Error(`Invalid portable view block: ${view.name}`);
    }
    // Portable blocks must contain no database-qualified references at all.
    assertLocalView(view.sql, '__no_database_qualifiers__');
  }
  return { tables, views: views.map(v => v.name).sort(), viewDefinitions: views };
}

function sameNames(actual, expected) {
  return Array.isArray(expected) && new Set(expected).size === expected.length &&
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

async function verifyRestoredViews(connection, database) {
  const [views] = await connection.query(
    'SELECT table_name AS name, view_definition AS definition, DEFINER AS definer FROM information_schema.views WHERE table_schema = DATABASE()'
  );
  const [accounts] = await connection.query('SELECT CURRENT_USER() AS account');
  const checks = [];
  for (const view of views) {
    const check = { name: view.name, local_dependencies: false, definer_ok: false, select_ok: false, error: null };
    try {
      if (!view.definition) throw new Error('View definition unavailable; SHOW VIEW privilege required');
      assertLocalView(view.definition, database);
      check.local_dependencies = true;
      if (view.definer !== accounts[0].account) throw new Error('View definer differs from restoring account');
      check.definer_ok = true;
      await connection.query(`SELECT * FROM ${quoteIdentifier(view.name)} LIMIT 1`);
      check.select_ok = true;
    } catch (error) { check.error = error.message; }
    checks.push(check);
  }
  return { names: views.map(view => view.name), checks };
}

module.exports = { CORE_TABLES, CORE_VIEWS, quoteIdentifier, portableView,
  schemaInventory, assertLocalView, sameNames, verifyRestoredViews };
