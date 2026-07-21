# HallSync SaaS Production Readiness — Two-Phase Plan

This is the operating plan for moving HallSync from “working live app” to “production-owned SaaS”.

The goal is not to add random enterprise complexity. The goal is simple: bookings, payments, invoices, tenant data, and owner trust must survive normal production failure cases.

## Phase 1 — Launch-safe foundation

Phase 1 contains the work that should be completed before serious paid onboarding or marketing.

### 1. Environment and provider readiness

Required backend values:

- `NODE_ENV=production`
- `PORT`
- `API_PREFIX=/api`
- `CORS_ORIGIN=https://hallsync.in` or the final frontend origin
- `FRONTEND_URL=https://hallsync.in`
- `PUBLIC_APP_URL=https://hallsync.in`
- `PUBLIC_API_BASE_URL=https://api.hallsync.in`
- `JWT_SECRET`
- `JWT_EXPIRES_IN=8h`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `ERROR_MONITORING_DSN`
- `UPTIME_MONITOR_HEALTH_URL`
- `UPTIME_MONITOR_FRONTEND_URL`
- `OPS_ALERT_RECIPIENT`
- `UPI_ID`

What the app should do:

- Missing required core values should block startup or launch gate.
- Optional integrations must degrade gracefully.
- Production operations screen should show missing/incomplete providers.

Current implementation direction:

- SMTP incomplete/disabled: email actions skip safely and the UI can still show copyable links.
- Cloudinary missing:
  - public non-sensitive assets can use local VPS fallback under `/uploads`;
  - sensitive payment/subscription proofs are blocked with a clear storage-not-configured response.

### 2. Email / SMTP readiness

Provider for launch: Brevo.

Required DNS:

- SPF
- DKIM
- DMARC

Recommended sender:

- `noreply@hallsync.in` for system emails
- `support@hallsync.in` for human support

Tenant-facing emails should use HallSync as the sender for now, but the content should clearly show the venue business name. Tenant custom sender domains can come later.

Launch requirement:

- Tenant invitation still works without email by showing a copyable link.
- Booking/invoice/payment reminder email failure must never fail the booking, invoice, or payment action.

### 3. Storage readiness

Provider for launch: Cloudinary.

Storage rules:

- Hall images and public tenant logos are non-sensitive.
- Payment proofs and subscription proofs are sensitive.
- Cloudinary API secret must never be exposed in frontend code.
- Sensitive proof URLs must be short-lived/signed.

Fallback rules:

- Business logos and public hall gallery images may fall back to local VPS storage.
- Payment proof upload must not fall back to public local storage.
- If proof storage is missing, show “Storage not configured” and keep payment/manual action flow safe.

### 4. Database backup and restore

Required:

- Daily automated MySQL backup.
- Backup before every production migration.
- Backup verification after backup.
- Monthly restore drill into a non-production database.

Operator sequence before migrations:

```bash
cd /var/www/hallsync/backend
set -a
source /etc/hallsync-api.env
set +a

npm run production:backup
npm run production:backup:verify
ALLOW_PRODUCTION_MIGRATIONS=true npm run migrate:platform
```

### 5. Monitoring and logs

Minimum launch stack:

- UptimeRobot or Better Stack for:
  - `https://api.hallsync.in/api/health`
  - `https://hallsync.in`
- Error monitoring DSN configured for backend and frontend.
- Systemd logs retained.
- Nginx access/error logs available.

Useful commands:

```bash
journalctl -u hallsync-api -n 120 --no-pager
tail -n 100 /var/log/nginx/error.log
tail -n 100 /var/log/nginx/access.log
```

### 6. Payment safety

Payment records are financial trust records. They should never be deleted or silently overwritten.

Launch requirements:

- Payment lifecycle statuses.
- Receipt number.
- Verification queue.
- Reverse/fail flows with reason.
- Linked booking/customer/hall details visible.
- Reconciliation summary.
- Audit logs for sensitive actions.

Golden rule:

- Wrong payment? Reverse or correct with audit trail. Do not delete.

### 7. Tenant isolation

Every tenant-owned API must scope by tenant context.

Launch checks:

- Reminders show only current tenant data.
- Bookings/payments/invoices/customers/halls/packages are tenant-scoped.
- Platform super admin routes are separate and intentionally privileged.
- Regression tests for tenant boundaries must pass before deploy.

## Phase 2 — Strong SaaS operations

Phase 2 makes the product more scalable and easier to operate as paid usage grows.

### 1. Email logs and retry queue

Add:

- `email_events` table.
- Email send status: `queued`, `sent`, `failed`.
- Retry count and last error.
- Resend button from owner/admin UI.

### 2. WhatsApp Business API

Current launch approach:

- `wa.me` links with prefilled messages.
- No API keys required.

Future upgrade:

- WhatsApp Business Cloud API.
- Template approval.
- Delivery status.
- Per-tenant messaging preferences.

Keep `wa.me` as fallback even after API integration.

### 3. Off-host backup copy

Add one off-VPS destination:

- S3-compatible bucket,
- Backblaze B2,
- Cloudflare R2,
- or another secure backup server.

Keep:

- 7 daily backups,
- 4 weekly backups,
- 3 monthly backups.

### 4. Staging environment

Add:

- `staging.hallsync.in`
- `staging-api.hallsync.in`
- separate staging database
- separate staging Cloudinary folder/account
- separate `.env.e2e.local`

Production write tests should never run against production.

### 5. Full CI/CD release gates

Backend deploy:

- build
- tests
- deploy
- health check
- rollback notes

Frontend deploy:

- lint
- build
- deploy static bundle
- smoke check

Migrations:

- controlled production migration window only
- backup first
- migration second
- health/reconciliation checks after

### 6. Security hardening

Add:

- Periodic credential rotation checklist.
- Session invalidation process.
- File upload malware/extension checks if documents expand.
- Role permission matrix review.
- Super-admin audit exports.

## Current Phase 1 implementation status

Implemented:

- Structured integration readiness helper for SMTP, Cloudinary, error monitoring, and uptime values.
- Server startup logs provider readiness statuses.
- Platform operations endpoint reports integration readiness with missing keys.
- SMTP send paths skip safely when disabled/incomplete.
- Public hall gallery upload can fall back to local VPS storage.
- Sensitive proof upload requires configured Cloudinary and returns a clear unavailable error instead of crashing.

Still needs operator setup:

- Brevo domain authentication.
- Cloudinary account/credentials.
- Uptime monitoring account.
- Error monitoring provider DSN.
- Backup timer verification on VPS.
- Off-host backup decision.

## Phase 1 final verification

Run locally before pushing:

```bash
cd backend
npm test
npm run build
npm run production:deployment-audit
```

Run on VPS after deploy:

```bash
cd /var/www/hallsync/backend
set -a
source /etc/hallsync-api.env
set +a

npm run production:readiness
npm run production:backup
npm run production:backup:verify
curl https://api.hallsync.in/api/health
```

