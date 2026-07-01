# Database Migrations

The backend uses a tracked migration runner for platform-owned schema changes.
Do not execute individual migration files manually in production.

## Run

```bash
npm run migrate:platform
```

The runner:

- reads database credentials from `.env`
- creates the `schema_migrations` tracking table
- runs each pending platform migration once, in filename order
- supports verified TLS when `DB_SSL=true`
- stops immediately if a migration fails

Current platform migrations:

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
- `311_tenant_upi_settings.sql`

For the distinction between tracked migrations, legacy migration history,
`schema_v2.sql`, backups, and restore drills, read `../docs/DATABASE.md`.

## Production Procedure

1. Create and verify a database backup.
2. Put the application into a short maintenance window.
3. Deploy the new backend code.
4. Run `npm run production:migrate` (it creates another backup and invokes the
   lower-level runner with the production guard explicitly enabled).
5. Start the backend and run the release smoke tests.
6. Record the deployment and migration output.

Never edit a migration that has already run in production. Add a new,
numbered migration for every later schema change.
