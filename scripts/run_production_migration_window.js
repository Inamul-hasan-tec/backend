const { spawn } = require('child_process');

function run(label, command, args, env = process.env, allowFailure = false) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> ${label}`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowFailure) {
        resolve(code);
      } else {
        reject(new Error(`${label} failed with code ${code}`));
      }
    });
  });
}

async function main() {
  await run('Pre-migration audit', 'node', ['scripts/audit_staging_schema.js'], process.env, true);
  await run('Database backup', 'node', ['scripts/backup_database.js']);
  await run(
    'Apply platform migrations',
    'node',
    ['scripts/run_platform_migrations.js'],
    {
      ...process.env,
      ALLOW_PRODUCTION_MIGRATIONS: 'true',
    }
  );
  await run('Post-migration audit', 'node', ['scripts/audit_staging_schema.js'], {
    ...process.env,
    HALL_SYNC_PRODUCTION_TARGET: 'true',
  });
}

main().catch((error) => {
  console.error('Production migration window failed:', error.message);
  process.exitCode = 1;
});
