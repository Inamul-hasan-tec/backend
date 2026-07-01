# Hall Sync Database Baseline and Migration Guide

**Last updated:** 2026-06-21 08:20 IST
**Database:** MySQL 8
**Production-target database:** Aiven `defaultdb`

## Source of Truth

The live schema plus the `schema_migrations` table is the authoritative schema
state. The production-target database is currently migrated through:

- `300_platform_tenant_lifecycle.sql`
- `301_subscription_billing.sql`
- `302_booking_payment_integrity.sql`
- `303_full_day_slots.sql`
- `304_invoice_integrity.sql`
- `305_invoice_payment_allocations.sql`
- `306_booking_payment_mode.sql`
- `307_subscription_collations.sql`
- `308_auth_session_revocation.sql`
- `309_invitations_subscription_policy.sql`
- `310_user_phone.sql`

`npm run production:audit` must report no missing tables/columns, invalid
collations, duplicate payment references, or pending migrations.

## File Roles

| Location | Role | May be run against production? |
| --- | --- | --- |
| `migrations/300+` | Forward-only tracked platform migrations | Only through `npm run production:migrate` |
| `migrations/000_create_migration_tracker.sql` | Historical tracker definition | No |
| `migrations/001`, `002`, `101-107`, `200`, `201` | Legacy development history retained for reference | No |
| `database/schema_v2.sql` | Historical/bootstrap reference, not live migration truth | No |
| `backups/database/*.sql` | Portable recovery artifacts with checksum manifests | Restore only to an isolated target first |

The legacy `migration_tracker` table remains in production for compatibility,
but all current migration decisions use `schema_migrations`. Do not delete the
legacy tracker or replay old migrations without an approved cleanup plan.

## Safe Commands

From `backend/`:

```bash
npm run production:audit
npm run production:readiness
npm run production:migrate
npm run production:backup
npm run production:backup:verify
npm run production:restore:drill
```

`production:migrate` is the only approved production-target migration entry
point. It performs a pre-audit, creates a backup, runs pending additive
migrations, and performs a production-target post-audit.

The lower-level `migrate:platform` command is for disposable/non-production
databases. It refuses production/default targets unless the guarded migration
window explicitly enables it.

## Adding a Migration

1. Add the next numbered, forward-only SQL file under `migrations/`.
2. Make it safe for existing data and idempotent where practical.
3. Add its filename to:
   - `scripts/run_platform_migrations.js`
   - `scripts/audit_staging_schema.js`
   - `scripts/production_readiness_audit.js`
4. Add required tables/columns to the schema audit.
5. Run backend tests/build and a non-production rehearsal when available.
6. Use the backup-first production migration window.
7. Record backup, audit, and acceptance evidence in canonical docs.

Never edit a migration already recorded in `schema_migrations`; add a new
numbered migration instead.

## Backups and Restore

Backups live outside both application repositories under
`backups/database/`. Current backups include JSON manifests with database,
size, table count, portability, and SHA-256 metadata.

Before trusting a backup:

```bash
npm run production:backup:verify
```

A restore drill must use a separately created empty database and explicit
`RESTORE_DB_*` credentials. Never point restore-drill variables at `defaultdb`.
See `docs/05-operations/BACKUP-AND-RESTORE-OPERATIONS.md` for the complete
procedure and reconciliation requirements.

## Current Constraint

The production schema and backup tooling are verified. The remaining database
operations gate is an executed restore/reconciliation drill against a separate
empty restore-test database.
