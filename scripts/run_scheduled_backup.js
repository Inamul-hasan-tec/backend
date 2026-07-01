const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const backupDir = path.resolve(__dirname, '../../backups/database');
const lockPath = path.join(backupDir, '.scheduled-backup.lock');
const heartbeatPath = path.join(backupDir, 'scheduler-heartbeat.json');
const staleLockMs = 6 * 60 * 60 * 1000;

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });
  });
}

function writeHeartbeat(status, detail = {}) {
  fs.writeFileSync(
    heartbeatPath,
    `${JSON.stringify({ status, recorded_at: new Date().toISOString(), ...detail }, null, 2)}\n`,
    { mode: 0o600 }
  );
}

function acquireLock() {
  fs.mkdirSync(backupDir, { recursive: true });
  if (fs.existsSync(lockPath)) {
    const ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (ageMs <= staleLockMs) {
      throw new Error(`Scheduled backup already running; lock age is ${(ageMs / 60000).toFixed(1)} minutes`);
    }
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
}

async function main() {
  acquireLock();
  const startedAt = new Date().toISOString();
  writeHeartbeat('running', { started_at: startedAt });
  try {
    await runScript('backup_database.js');
    await runScript('verify_database_backup.js');
    await runScript('prune_database_backups.js');
    writeHeartbeat('success', { started_at: startedAt, completed_at: new Date().toISOString() });
  } catch (error) {
    writeHeartbeat('failed', { started_at: startedAt, failed_at: new Date().toISOString(), error: error.message });
    throw error;
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

main().catch((error) => {
  console.error('Scheduled backup failed:', error.message);
  process.exitCode = 1;
});
