# HallSync VPS Operations Checks

Use these checks after every production deploy and before serious customer testing.

## 1. Load production environment

```bash
cd /var/www/hallsync/backend
set -a
source /etc/hallsync-api.env
set +a
```

## 2. API health

```bash
curl https://api.hallsync.in/api/health
systemctl status hallsync-api --no-pager -l
journalctl -u hallsync-api -n 80 --no-pager
```

Expected:

- health endpoint returns `success: true`
- service is `active (running)`
- startup logs include `server_started`
- when Sentry is configured, startup logs include `error_monitoring_enabled`

## 3. Sentry backend smoke test

Login as the platform/super admin, copy the token from the browser network tab,
then run:

```bash
curl -X POST https://api.hallsync.in/api/platform/operations/error-monitoring/test \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

Expected response:

```json
{
  "success": true,
  "message": "Monitoring test event queued",
  "data": {
    "provider": "sentry"
  }
}
```

Then check Sentry Issues/Events for `HallSync production monitoring test`.

## 4. Manual verified backup

```bash
npm run production:backup
npm run production:backup:verify
npm run production:backup:retention
```

Set `BACKUP_RETENTION_APPLY=true` only when you want pruning to delete old
backup files. Without it, retention runs as a safe dry-run.

## 5. Enable daily verified backup timer

```bash
cp deploy/vps/systemd/hallsync-backup.service /etc/systemd/system/hallsync-backup.service
cp deploy/vps/systemd/hallsync-backup.timer /etc/systemd/system/hallsync-backup.timer

systemctl daemon-reload
systemctl enable --now hallsync-backup.timer
systemctl list-timers hallsync-backup.timer --no-pager
```

To run it immediately:

```bash
systemctl start hallsync-backup.service
journalctl -u hallsync-backup.service -n 120 --no-pager
```

## 6. Production readiness

```bash
npm run production:audit
npm run production:readiness
```

The readiness audit uses `BACKUP_DIR` from `/etc/hallsync-api.env`, so keep it
aligned with the systemd service `ReadWritePaths`:

```env
BACKUP_DIR=/var/www/hallsync/backups/database
```
