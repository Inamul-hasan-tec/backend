# Backend CI/CD for HallSync

This deploys the backend from GitHub to the VPS when the `production` branch is pushed.

## Flow

```text
feature/hall-sync-updates
  -> test locally
  -> merge into production
  -> push production
  -> GitHub Actions builds backend
  -> GitHub Actions SSHs into VPS
  -> VPS pulls production branch
  -> npm ci
  -> npm run build
  -> systemctl restart hallsync-api
  -> health check https://api.hallsync.in/api/health
```

## GitHub secrets required

Add these in the backend GitHub repository:

```text
VPS_HOST=72.62.230.143
VPS_USER=root
VPS_SSH_KEY=<private SSH key allowed to access the VPS>
BACKEND_PATH=/var/www/hallsync/backend
BACKEND_BRANCH=production
BACKEND_SERVICE_NAME=hallsync-api
API_HEALTH_URL=https://api.hallsync.in/api/health
```

`BACKEND_PATH`, `BACKEND_BRANCH`, `BACKEND_SERVICE_NAME`, and `API_HEALTH_URL` have safe defaults in the workflow, but keeping them as secrets makes the workflow easier to change later.

Do not put `.env` values in GitHub Actions. Production runtime secrets should stay on the VPS in:

```text
/etc/hallsync-api.env
```

## First-time VPS check

Run this once on the VPS before relying on CI/CD:

```bash
cd /var/www/hallsync/backend
git remote -v
git fetch origin
git branch -a
systemctl status hallsync-api --no-pager
curl https://api.hallsync.in/api/health
```

The backend directory must be a clean clone that can safely be reset to `origin/production`.

## Deploy manually from local machine

Use this when you are ready to make current backend work live:

```bash
cd "/Users/inamulhasan/Desktop/Frontend Course/untitled folder/backend"

git checkout feature/hall-sync-updates
git status

# Commit all intended backend changes first.
git add .github/workflows/deploy-backend.yml deploy/vps/BACKEND-CICD.md src/repositories/SettingsRepository.ts src/services/SettingsService.ts src/server.ts
git commit -m "chore: add backend production cicd"
git push origin feature/hall-sync-updates

# Merge into production only when ready to deploy live.
git checkout production
git merge feature/hall-sync-updates
git push origin production

git checkout feature/hall-sync-updates
```

Pushing `production` triggers the backend deployment.

## Migrations policy

Production migrations are intentionally not run by this CI/CD workflow.

For now:

```text
Code deploy = automatic
Database migration = manual, planned, and backed up
```

Before running a production migration:

```bash
cd /var/www/hallsync/backend
npm run production:backup
ALLOW_PRODUCTION_MIGRATIONS=true npm run migrate:platform
```

If we later want this automated, use a separate protected workflow with manual approval.

## Health check behavior

After restart, the workflow calls:

```text
https://api.hallsync.in/api/health
```

It retries 5 times. If the health check fails, the GitHub Action fails and prints:

```bash
systemctl status hallsync-api --no-pager
journalctl -u hallsync-api -n 80 --no-pager
```

## Rollback

If a production deploy is bad, SSH into the VPS and roll back to the previous known-good commit.

```bash
ssh root@72.62.230.143

cd /var/www/hallsync/backend
git log --oneline -10
```

Pick the previous good commit SHA, then:

```bash
git reset --hard <GOOD_COMMIT_SHA>
npm ci
npm run build
systemctl restart hallsync-api
curl https://api.hallsync.in/api/health
```

If the service still fails:

```bash
systemctl status hallsync-api --no-pager
journalctl -u hallsync-api -n 120 --no-pager
```

After rollback, fix the branch in GitHub too:

```bash
git checkout production
git revert <BAD_COMMIT_SHA>
git push origin production
```

This keeps GitHub and the VPS aligned.

## Later phase: staging

Add staging after production deploy is stable:

```text
staging branch
  -> staging API domain
  -> staging DB
  -> staging systemd service
  -> staging GitHub Actions workflow
```

Do not point staging at the production database.
