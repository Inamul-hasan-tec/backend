const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { backupDir: resolveBackupDir } = require('./backup_paths');
const { schemaInventory, sameNames, CORE_TABLES, CORE_VIEWS } = require('./backup_schema');

function checksum(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function latestBackup(backupDir) {
  const candidates = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir)
        .filter((name) => name.endsWith('.sql'))
        .map((name) => {
          const filePath = path.join(backupDir, name);
          return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
    : [];
  return candidates[0]?.filePath;
}

function verifyBackup(backupPath) {
  if (!backupPath || !fs.existsSync(backupPath)) {
    throw new Error(`Backup file does not exist: ${backupPath || '<missing>'}`);
  }

  const manifestPath = `${backupPath}.json`;
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup manifest does not exist: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const stat = fs.statSync(backupPath);
  const actualChecksum = checksum(backupPath);
  const errors = [];
  const inventory = schemaInventory(fs.readFileSync(backupPath, 'utf8'));
  if (stat.size === 0) errors.push('empty backup');
  if (manifest.manifest_version !== 3) errors.push('schema-complete v3 backup required; legacy backups omit views');

  if (manifest.backup_file !== path.basename(backupPath)) errors.push('backup filename mismatch');
  if (Number(manifest.size_bytes) !== stat.size) errors.push('backup size mismatch');
  if (manifest.sha256 !== actualChecksum) errors.push('backup checksum mismatch');
  if (!Number.isInteger(Number(manifest.base_table_count)) || Number(manifest.base_table_count) <= 0) {
    errors.push('invalid base table count');
  }
  if (inventory.tables.length !== Number(manifest.base_table_count) || !sameNames(inventory.tables, manifest.base_table_names)) {
    errors.push('base table inventory mismatch');
  }
  if (!Number.isInteger(manifest.view_count) || inventory.views.length !== manifest.view_count ||
      !sameNames(inventory.views, manifest.view_names)) errors.push('view inventory mismatch');
  for (const name of CORE_TABLES) if (!inventory.tables.includes(name)) errors.push(`missing core table: ${name}`);
  for (const name of CORE_VIEWS) if (!inventory.views.includes(name)) errors.push(`missing required view: ${name}`);
  if (manifest.view_definer_policy !== 'restore_current_user') errors.push('unsupported view definer policy');
  if (manifest.portable_restore !== true) errors.push('backup not portable');

  if (errors.length > 0) {
    throw new Error(`Backup verification failed: ${errors.join(', ')}`);
  }

  return {
    ok: true,
    backup_path: backupPath,
    manifest_path: manifestPath,
    size_bytes: stat.size,
    sha256: actualChecksum,
    base_table_count: Number(manifest.base_table_count),
    base_table_names: inventory.tables,
    view_count: inventory.views.length,
    view_names: inventory.views,
    view_definer_policy: manifest.view_definer_policy,
    portable_restore: manifest.portable_restore === true,
    database: manifest.database,
  };
}

function main() {
  const backupDir = resolveBackupDir();
  const requestedPath = process.env.BACKUP_FILE
    ? path.resolve(process.env.BACKUP_FILE)
    : latestBackup(backupDir);
  console.log(JSON.stringify(verifyBackup(requestedPath), null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Backup verification failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { verifyBackup };
