# Schema-complete backup verification

## Root cause and scope

The old backup intentionally discovered views and passed each to mysqldump as `--ignore-table`. Nothing subsequently recreated them. Verification checked manifest/checksum and a positive base-table count, so a table-only backup could pass. The restore drill also checked only tables.

The inspected code/history does not record why the exclusion was introduced. It avoids mysqldump's view placeholders and source-account definers, but a compatibility motive is an inference, not a documented fact. No security requirement to omit these views was found.

The new backup retains the base-table dump and appends actual `SHOW CREATE VIEW` definitions. Source-database identifier qualifiers are removed without rewriting string literals. View definers become `CURRENT_USER`; original SQL SECURITY DEFINER/INVOKER, algorithm, check option, and character-set/collation metadata are preserved. A restoring account therefore owns the views. No source production account must exist on the recovery server.

Manifest v3 records exact base-table names/count, view names/count, and the definer policy, while retaining timestamp, checksum, size, filename and portability metadata. `ignored_views` is now empty. Verification requires both `booking_details` and `dashboard_stats`, all core tables, and exact agreement between SQL and manifest inventories. Old v2 files remain untouched but no longer pass the schema-complete verification gate.

The restore drill compares all names/counts, requires an empty target including views, checks definitions for foreign database dependencies, checks the actual definer against the importing account, and executes `SELECT * ... LIMIT 1` for every restored view. SELECT failures are recorded in its JSON report. It refuses both configured-source and manifest-source database names as restore targets.

Scheduled backup locking, heartbeat, pruning/retention, and launch-gate orchestration are unchanged. They automatically use the strengthened verifier. Readiness additionally compares the backup's view inventory and table count with the current source schema.

## Verification performed

Only offline fixture/mock tests, JavaScript syntax checks, the TypeScript build, and whitespace validation were run. No database connection, backup, restore, migration or deployment was performed for this task.

## Proposed production commands (not executed)

After the code has been reviewed and deployed through your normal release process:

```bash
cd /var/www/hallsync/backend
set -a
source /etc/hallsync-api.env
set +a
npm run test:backup
npm run production:backup
```

Set `BACKUP_FILE` to the exact `backup_path` printed by that successful backup, then verify the new artifact:

```bash
export BACKUP_FILE=/var/www/hallsync/backups/database/EXACT_NEW_BACKUP_FILENAME.sql
npm run production:backup:verify
node -e 'const r=require("./scripts/verify_database_backup").verifyBackup(process.env.BACKUP_FILE); if(r.base_table_count!==41 || r.view_count!==2 || !["booking_details","dashboard_stats"].every(n=>r.view_names.includes(n))) throw new Error("Unexpected production schema inventory"); console.log("41 tables and both views verified");'
```

If production has legitimately added objects since this audit, review its live inventory rather than forcing the old count of 41/2.

Prepare an EMPTY `hallsync_restore_drill` database through your DBA procedure. Use a dedicated restore account with privileges on that database only, including CREATE VIEW, SHOW VIEW and SELECT plus the privileges required for the existing table/routine/event dump. It should have no read grants on `hallsync_prod`, making any accidental production dependency fail visibly. Supply RESTORE_DB_USER/PASSWORD/HOST/PORT in a protected restore environment file, not shell history:

```bash
set -a
source /etc/hallsync-restore-drill.env
set +a
: "${RESTORE_DB_USER:?Dedicated restore user is required}"
: "${RESTORE_DB_PASSWORD:?Restore password is required}"
export RESTORE_DB_NAME=hallsync_restore_drill
export RESTORE_DRILL_CONFIRM=true
npm run production:restore:drill
```

Expected report: `ok: true`, 41 restored base tables, two restored views, and successful local dependency/definer/SELECT checks for both views. Preserve this report with the release evidence. This command writes only to the prepared restore database, never the source. It does not create or delete the target database.

To exercise the unchanged scheduled workflow once (writes backup/heartbeat files and applies configured retention):

```bash
unset BACKUP_FILE
npm run production:backup:scheduled
npm run production:readiness
```

Readiness may report unrelated application blockers; examine the individual backup checks.

## Remaining risks

- A real MySQL restore with the deployed client/server versions is still required. Offline tests validate normalization and verification behavior, not server execution.
- SHOW VIEW privilege is required for the backup user. Failure stops the backup rather than silently omitting a view.
- Definer rights now belong to the importing account. Use a deliberately scoped persistent restore/runtime account, and review grants before disaster cutover. INVOKER views still require the caller's underlying table privileges.
- Existing stored routine, trigger and event behavior remains unchanged; their own definers are outside this view-specific change. They may require separate portability hardening if present.
- Avoid concurrent schema changes during a backup: table data uses the existing single-transaction dump, while view definitions are captured separately.
- View dependency ordering supports the application's FROM/JOIN definitions. Unusual future SQL, cross-schema views or nonstandard SHOW CREATE formats need additional fixtures/rehearsal; detected unsupported definitions fail the backup.
- Legacy backups still have recovery value for tables, but require separate view recovery and cannot satisfy the new schema-complete launch gate.
