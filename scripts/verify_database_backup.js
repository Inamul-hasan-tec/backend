const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

  if (manifest.backup_file !== path.basename(backupPath)) errors.push('backup filename mismatch');
  if (Number(manifest.size_bytes) !== stat.size) errors.push('backup size mismatch');
  if (manifest.sha256 !== actualChecksum) errors.push('backup checksum mismatch');
  if (!Number.isInteger(Number(manifest.base_table_count)) || Number(manifest.base_table_count) <= 0) {
    errors.push('invalid base table count');
  }

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
    portable_restore: manifest.portable_restore === true,
    database: manifest.database,
  };
}

function main() {
  const backupDir = path.resolve(__dirname, '../../backups/database');
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
