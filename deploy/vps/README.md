# Hall Sync VPS Deployment Pack

This folder contains production templates for a single-VPS pilot deployment.
They are safe to commit because they contain placeholders only.

Before configuring the server, fill the non-secret values in
`VALUES-CHECKLIST.md`. Put real secrets only in `/etc/hallsync-api.env` or a
provider secret store.

Target shape:

- Nginx serves the React build from `/var/www/hallsync/frontend`.
- Nginx proxies `/api` to the backend at `127.0.0.1:5000`.
- `systemd` runs the backend from `/var/www/hallsync/backend`.
- A `systemd` timer runs the verified backup job once per day.
- HTTPS is provided by Certbot/Let's Encrypt on the real domain.

## 1. DNS

Point these records to the VPS public IP:

```text
app.hallsync.in  A  72.62.230.143
api.hallsync.in  A  72.62.230.143
```

Keep the values exact; CORS must not use `*`.

## 2. Server packages

Install on Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Install Node.js 20 LTS or newer using your preferred trusted method. Then check:

```bash
node --version
npm --version
nginx -v
systemctl --version
```

## 3. Directory layout

```bash
sudo mkdir -p /var/www/hallsync/backend
sudo mkdir -p /var/www/hallsync/frontend
sudo mkdir -p /var/www/hallsync/backups/database
sudo chown -R $USER:www-data /var/www/hallsync
```

Copy backend source/build files into `/var/www/hallsync/backend` and frontend
`dist/` contents into `/var/www/hallsync/frontend`.

## 4. Backend environment

Create the real backend env file on the VPS:

```bash
sudo cp deploy/vps/backend.env.production.example /etc/hallsync-api.env
sudo chmod 600 /etc/hallsync-api.env
sudo nano /etc/hallsync-api.env
```

Do not paste secrets into Git, chat, screenshots, or docs.

Minimum production values that must be real:

- `NODE_ENV=production`
- `CORS_ORIGIN=https://app.hallsync.in`
- `FRONTEND_URL=https://app.hallsync.in`
- `JWT_SECRET=<new long random value>`
- database host/user/password/name/SSL CA
- `SMTP_*`
- platform subscription `UPI_ID`; tenant/customer UPI is configured per tenant
  in Business Profile
- `CLOUDINARY_*`
- monitoring/uptime/alert values

## 5. Frontend build environment

Before building the frontend for production, use the frontend env template from
this backend repo:

```bash
cd hall-sync-calendar-view
cp ../backend/deploy/vps/frontend.env.production.example .env.production
nano .env.production
npm ci
npm run lint
npm run build
```

Then copy `dist/` to the VPS frontend directory.

## 6. systemd services

On the VPS:

```bash
sudo cp deploy/vps/systemd/hallsync-api.service /etc/systemd/system/hallsync-api.service
sudo cp deploy/vps/systemd/hallsync-backup.service /etc/systemd/system/hallsync-backup.service
sudo cp deploy/vps/systemd/hallsync-backup.timer /etc/systemd/system/hallsync-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now hallsync-api
sudo systemctl enable --now hallsync-backup.timer
```

Check:

```bash
systemctl status hallsync-api --no-pager
journalctl -u hallsync-api -n 100 --no-pager
systemctl list-timers hallsync-backup.timer --no-pager
```

## 7. Nginx

Copy and edit the Nginx template:

```bash
sudo cp deploy/vps/nginx/hallsync.conf /etc/nginx/sites-available/hallsync.conf
sudo nano /etc/nginx/sites-available/hallsync.conf
sudo ln -s /etc/nginx/sites-available/hallsync.conf /etc/nginx/sites-enabled/hallsync.conf
sudo nginx -t
sudo systemctl reload nginx
```

Then issue HTTPS certificates:

```bash
sudo certbot --nginx -d app.hallsync.in -d api.hallsync.in
```

After Certbot, run `sudo nginx -t` and `sudo systemctl reload nginx`.

## 8. Required verification

From the VPS backend directory:

```bash
npm ci --omit=dev
npm run build
npm run production:audit
npm run production:readiness
npm run production:backup
npm run production:backup:verify
```

From your machine:

```bash
curl -I https://app.hallsync.in
curl https://api.hallsync.in/api/health
```

Then run the release gate:

```bash
cd backend
npm run production:launch-gate
```

The launch gate should have zero blockers. It may still warn until SMTP,
monitoring, uptime, and scheduler values are fully active.

## 9. Pilot go-live rule

Do not onboard a real customer until all of these are true:

- API and frontend are HTTPS.
- CORS is exact and non-wildcard.
- backend is managed by systemd and restarts on failure.
- a fresh backup verifies.
- backup timer heartbeat is visible.
- database/SMTP/JWT credentials have been rotated.
- production acceptance and smoke browser tests pass.
- monitoring and uptime alerts are configured.
