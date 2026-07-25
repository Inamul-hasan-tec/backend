const path = require('path');

function backupDir() {
  return path.resolve(
    process.env.BACKUP_DIR || path.join(__dirname, '../../backups/database')
  );
}

function backupHeartbeatPath() {
  return path.join(backupDir(), 'scheduler-heartbeat.json');
}

module.exports = {
  backupDir,
  backupHeartbeatPath,
};
