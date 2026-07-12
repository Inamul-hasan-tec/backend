import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const servicePath = join(__dirname, '..', 'src', 'services', 'ReminderService.ts');

export function testReminderQueriesAreTenantScoped() {
  const source = readFileSync(servicePath, 'utf8');

  assert.match(
    source,
    /import\s+\{\s*getTenantId\s*\}\s+from\s+['"]\.\.\/utils\/tenantContext['"]/,
    'ReminderService must use tenant context'
  );

  assert.equal(
    (source.match(/AND b\.tenant_id = \?/g) || []).length,
    3,
    'Every reminder booking query must filter by the current tenant'
  );

  assert.equal(
    (source.match(/c\.tenant_id = b\.tenant_id/g) || []).length,
    3,
    'Reminder customer joins must be tenant-safe'
  );

  assert.equal(
    (source.match(/h\.tenant_id = b\.tenant_id/g) || []).length,
    3,
    'Reminder hall joins must be tenant-safe'
  );

  assert.doesNotMatch(
    source,
    /'full_day'\s+as\s+time_slot/i,
    'Reminder queries must return the actual booking slot, not a hardcoded slot'
  );
}
