const fs = require('fs');
const path = require('path');

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function main() {
  const retentionDays = positiveInteger('BACKUP_RETENTION_DAYS', 30);
  const minimumCount = positiveInteger('BACKUP_RETENTION_MIN_COUNT', 7);
  if (retentionDays < 7) {
    throw new Error('BACKUP_RETENTION_DAYS cannot be less than 7');
  }

  const apply = process.env.BACKUP_RETENTION_APPLY === 'true';
  const backupDir = path.resolve(__dirname, '../../backups/database');
  const now = Date.now();
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const backups = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir)
        .filter((name) => name.endsWith('.sql'))
        .map((name) => {
          const filePath = path.join(backupDir, name);
          const stat = fs.statSync(filePath);
          return { name, filePath, modified_at: stat.mtime.toISOString(), mtimeMs: stat.mtimeMs, size_bytes: stat.size };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
    : [];

  const candidates = backups.filter(
    (backup, index) => index >= minimumCount && backup.mtimeMs < cutoff
  );

  if (apply) {
    for (const backup of candidates) {
      fs.unlinkSync(backup.filePath);
      const manifestPath = `${backup.filePath}.json`;
      if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? 'apply' : 'dry-run',
    backup_directory: backupDir,
    retention_days: retentionDays,
    minimum_backup_count: minimumCount,
    total_backups: backups.length,
    candidate_count: candidates.length,
    candidates: candidates.map(({ name, modified_at, size_bytes }) => ({ name, modified_at, size_bytes })),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error('Backup retention failed:', error.message);
  process.exitCode = 1;
}

