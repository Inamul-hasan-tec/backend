import assert from 'assert';
import { sanitizeAuditValue } from '../src/repositories/AuditRepository';

export function testAuditRedaction(): void {
  assert.deepStrictEqual(
    sanitizeAuditValue({
      name: 'Allowed',
      password: 'never-store',
      nested: { api_key: 'secret', status: 'active' },
      items: [{ token: 'secret-token', role: 'admin' }],
    }),
    {
      name: 'Allowed',
      password: '[REDACTED]',
      nested: { api_key: '[REDACTED]', status: 'active' },
      items: [{ token: '[REDACTED]', role: 'admin' }],
    }
  );
}
