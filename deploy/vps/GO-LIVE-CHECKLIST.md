# Hall Sync VPS Go-Live Checklist

Use this as the final operator checklist. Do not mark a real pilot live until
all required checks are complete.

## A. Before touching the VPS

- [ ] Backend and frontend changes are committed locally.
- [ ] Old exposed database, SMTP, and JWT credentials are rotated.
- [ ] Domain DNS points to the VPS.
- [ ] MySQL is bound to localhost / firewalled from public internet.
- [ ] SMTP sender is verified.
- [ ] Platform subscription UPI ID is confirmed.
- [ ] Tenant/customer UPI fields are configured for each pilot venue.
- [ ] Cloudinary account is configured.
- [ ] Error monitoring and uptime monitoring accounts are ready.

## B. Local release gate

```bash
cd backend
npm test
npm run build

cd ../hall-sync-calendar-view
npm run lint
npm run build
```

## C. VPS application setup

- [ ] `/var/www/hallsync/backend` exists.
- [ ] `/var/www/hallsync/frontend` exists.
- [ ] `/var/www/hallsync/backups/database` exists.
- [ ] `/etc/hallsync-api.env` exists and is mode `600`.
- [ ] MySQL production, staging, and restore-drill databases exist locally.
- [ ] Backend `npm ci` and `npm run build` pass on the VPS.
- [ ] Frontend `dist/` is deployed to the Nginx root.

## D. Process manager and HTTPS

- [ ] `hallsync-api.service` is enabled and running.
- [ ] `hallsync-backup.timer` is enabled and scheduled.
- [ ] Nginx config passes `nginx -t`.
- [ ] Certbot certificate issued successfully.
- [ ] `https://app.hallsync.in` opens the frontend.
- [ ] `https://api.hallsync.in/api/health` returns success.

## E. Production safety checks

```bash
cd /var/www/hallsync/backend
npm run production:audit
npm run production:readiness
npm run production:backup
npm run production:backup:verify
npm run production:launch-gate
```

- [ ] Launch gate has zero blockers.
- [ ] Latest backup is portable and checksummed.
- [ ] Scheduler heartbeat is fresh after the first timer run.
- [ ] Error monitoring receives a test event.
- [ ] Uptime monitor alerts are configured.

## F. Smoke acceptance

- [ ] Platform owner can sign in.
- [ ] Tenant owner can sign in.
- [ ] Tenant booking flow works.
- [ ] Payment and invoice screens load.
- [ ] Subscription payment instructions show the configured Hall Sync UPI ID.
- [ ] Tenant Business Profile stores the venue's own UPI ID/name for customer payments.
- [ ] Platform proof review works without exposing raw provider credentials.
- [ ] Logout revokes the session.

## G. Pilot rule

Invite the first venue only after A-F are complete. If anything fails, roll back
the application first; restore the database only after a separate restore
validation.
