# Hall Sync Backend

TypeScript, Express, and MySQL API for the Hall Sync multi-tenant SaaS.

## Requirements

- Node.js 20+
- npm
- MySQL 8+

## Setup

```bash
npm install
cp .env.example .env
npm run build
npm run dev
```

The default API URL is `http://localhost:5000/api`.

## Commands

```bash
npm run dev
npm run build
npm test
npm run migrate:platform
npm start
```

`migrate:platform` applies the platform-role, tenant-lifecycle, and manual
subscription billing migrations. Back up the database before applying
migrations in production.

## Security Boundaries

- Tenant routes require a tenant user and derive tenant scope from the verified
  token.
- Platform owners use `/api/platform/*` and `/api/tenants/*`.
- Platform owners are rejected from tenant booking, customer, payment,
  invoice, hall, package, and settings routes.
- Tenant admins manage their own staff through `/api/users` and
  `/api/settings/team`.
- No API returns password hashes.
- Failed logins are limited by both client IP and hashed account identity.
- Configure `TRUST_PROXY_HOPS` only for the exact deployed proxy chain.
- Every API response includes `X-Request-ID` for structured-log correlation.

Production login controls are configured through:

```text
TRUST_PROXY_HOPS
LOGIN_RATE_LIMIT_WINDOW_MS
LOGIN_RATE_LIMIT_MAX_IP_FAILURES
LOGIN_RATE_LIMIT_MAX_ACCOUNT_FAILURES
```

Pilot sessions use an absolute `JWT_EXPIRES_IN=8h` policy. There is no refresh
endpoint. `POST /api/auth/logout` revokes all current tokens for the user, and
password/status/role/membership changes also revoke prior tokens through the
database-backed `auth_version`.

## Important Routes

```text
POST /api/auth/login
GET  /api/health

GET  /api/tenants
POST /api/tenants
PUT  /api/tenants/:id

GET  /api/platform/subscription-payments
POST /api/platform/subscription-payments/:paymentId/approve
POST /api/platform/subscription-payments/:paymentId/reject

GET  /api/settings/subscription
POST /api/settings/subscription/generate-qr
POST /api/settings/subscription/payment
```

Project-level documentation is indexed at `../docs/README.md`.
