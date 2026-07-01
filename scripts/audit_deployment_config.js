const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(backendRoot, '..');
const renderPath = path.join(backendRoot, 'render.yaml');
const netlifyPath = path.join(workspaceRoot, 'hall-sync-calendar-view', 'netlify.toml');

const render = fs.readFileSync(renderPath, 'utf8');
const netlify = fs.readFileSync(netlifyPath, 'utf8');
const blockers = [];
const warnings = [];

function envBlock(key) {
  const match = render.match(new RegExp(`- key: ${key}\\n((?:\\s{8}.*\\n?){1,3})`));
  return match ? match[1] : '';
}

function requireSecretStore(key) {
  const block = envBlock(key);
  if (!block) blockers.push(`${key} is missing from render.yaml`);
  else if (!/sync:\s*false/.test(block) && !/generateValue:\s*true/.test(block)) {
    blockers.push(`${key} must use the deployment secret store`);
  }
}

[
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_SSL_CA_PATH',
  'JWT_SECRET',
  'CORS_ORIGIN',
  'FRONTEND_URL',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'UPI_ID',
  'ERROR_MONITORING_DSN',
  'UPTIME_MONITOR_HEALTH_URL',
  'UPTIME_MONITOR_FRONTEND_URL',
  'OPS_ALERT_RECIPIENT',
].forEach(requireSecretStore);

if (!/healthCheckPath:\s*\/api\/health/.test(render)) {
  blockers.push('Render healthCheckPath must be /api/health');
}
if (!/buildCommand:\s*npm ci && npm run build/.test(render)) {
  blockers.push('Render must use reproducible npm ci builds');
}
if (!/key:\s*DB_SSL\n\s+value:\s*["']?true["']?/.test(render)) {
  blockers.push('Render DB_SSL must be true');
}
if (!/key:\s*JWT_EXPIRES_IN\n\s+value:\s*8h/.test(render)) {
  blockers.push('Render JWT_EXPIRES_IN must follow the 8h policy');
}
if (/key:\s*CORS_ORIGIN\n\s+value:\s*["']?\*/.test(render)) {
  blockers.push('Wildcard production CORS is forbidden');
}
if (/plan:\s*free/.test(render)) {
  warnings.push('Render free plan is preview-only; select an always-on plan before pilot');
}

for (const header of [
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
  'Cross-Origin-Opener-Policy',
]) {
  if (!netlify.includes(header)) blockers.push(`Netlify security header missing: ${header}`);
}

const result = { ok: blockers.length === 0, blockers, warnings };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

