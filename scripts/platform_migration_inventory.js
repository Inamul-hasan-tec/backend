const fs = require('fs');
const path = require('path');

function getMigrationFiles(migrationsDir = path.join(__dirname, '../migrations')) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql') && /^3\d{2}_/.test(file))
    .sort((a, b) => Number(a.split('_')[0]) - Number(b.split('_')[0]) || a.localeCompare(b));
}

module.exports = { getMigrationFiles };
