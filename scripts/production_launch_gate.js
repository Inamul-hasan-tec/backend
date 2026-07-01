const { spawnSync } = require('child_process');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(backendRoot, '..');

function run(label, command, args, cwd = backendRoot) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`${label} failed`);
}

function readinessWithoutWarnings() {
  console.log('\n==> Production readiness (zero-warning launch policy)');
  const result = spawnSync(process.execPath, ['scripts/production_readiness_audit.js'], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error('Production readiness audit failed');
  const report = JSON.parse(result.stdout);
  if (!report.ok || report.blockers.length || report.warnings.length) {
    throw new Error(
      `Launch readiness requires zero blockers and zero warnings; blockers=${report.blockers.length}, warnings=${report.warnings.length}`
    );
  }
}

try {
  run('Deployment configuration audit', process.execPath, ['scripts/audit_deployment_config.js']);
  run('Full pilot preflight', 'bash', ['tools/pilot-preflight.sh'], workspaceRoot);
  run('Production schema audit', 'npm', ['run', 'production:audit']);
  run('Latest backup verification', 'npm', ['run', 'production:backup:verify']);
  readinessWithoutWarnings();
  console.log('\nProduction launch gate passed');
} catch (error) {
  console.error(`\nProduction launch gate blocked: ${error.message}`);
  process.exitCode = 1;
}

