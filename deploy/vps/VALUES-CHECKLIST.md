# Hall Sync VPS Launch Values Checklist

This file is safe to commit because it contains placeholders only. Put real
secrets directly in `/etc/hallsync-api.env` on the VPS or in the provider secret
store, never in Git.

## Domain and DNS

| Value | Current value | Status |
| --- | --- | --- |
| Frontend app domain | `https://hallsync.in` | `[x] DECIDED` |
| API domain | `https://api.hallsync.in` | `[x] DECIDED` |
| VPS public IP | `72.62.230.143` | `[x] DECIDED` |
| DNS A record for app domain | `hallsync.in -> 72.62.230.143` | `[ ] TODO` |
| DNS A record for API domain | `api.hallsync.in -> 72.62.230.143` | `[ ] TODO` |
| HTTPS certificate email | founder/operator email | `[ ] TODO` |

## Production Backend Environment

| Value | Required decision |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Usually `5000` behind Nginx |
| `CORS_ORIGIN` | `https://hallsync.in` |
| `FRONTEND_URL` / `PUBLIC_APP_URL` | `https://hallsync.in` |
| `PUBLIC_API_BASE_URL` | `https://api.hallsync.in` |
| `JWT_SECRET` | New generated secret after rotating old historical value |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Production database credentials |
| `DB_SSL_CA_PATH` | Empty for local VPS MySQL; use Unix/localhost access and firewall MySQL from public internet |
| `SESSION_MAX_AGE_HOURS` | `8` unless a release decision changes it |

## Provider Activation

| Area | Required before live pilot | Status |
| --- | --- | --- |
| Credential rotation | Rotate old DB, SMTP, and JWT values that appeared in backend Git history | `[ ] BLOCKING` |
| Database TLS | Provider CA copied to VPS and referenced by `DB_SSL_CA_PATH` | `[ ] BLOCKING` |
| SMTP | Verified sender, SMTP host/port/user/password, `SMTP_ENABLED=true` | `[ ] BLOCKING` |
| Subscription collection | Confirm Hall Sync business `UPI_ID`; tenant customer UPI is stored per tenant business profile | `[ ] BLOCKING` |
| Cloudinary/storage | Confirm private/signed proof handling and strict transformations/provider settings | `[ ] BLOCKING` |
| Error monitoring | Backend/frontend DSNs configured; test event received | `[ ] BLOCKING` |
| Uptime monitoring | App URL and API health monitored every 5 minutes; alert recipient configured | `[ ] BLOCKING` |
| Daily backups | `hallsync-backup.timer` enabled; first scheduled backup verified | `[ ] BLOCKING` |
| Off-host backup copy | Decide where backups are copied outside the VPS/database provider | `[ ] TODO` |

## Staging Write-Test Environment

Write E2E tests must not run against localhost or the production-target
database.

| Required staging value | Notes | Status |
| --- | --- | --- |
| Staging frontend URL | Must include a staging-like hostname | `[ ] TODO` |
| Staging API URL | Must include a staging-like hostname and end with `/api` | `[ ] TODO` |
| Staging database | Separate from production-target data | `[ ] TODO` |
| Staging storage/proof bucket | Separate from production proof storage | `[ ] TODO` |
| Ignored E2E credentials | Put only in `.env.e2e.local`, never Git | `[ ] TODO` |
