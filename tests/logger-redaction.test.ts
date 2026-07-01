import assert from 'assert';
import { sanitizeLogValue } from '../src/utils/logger';

export function testLoggerRedaction(): void {
  const sanitized = sanitizeLogValue({
    email: 'allowed@example.com',
    password: 'never-log-this',
    requestBody: { customer_name: 'Private Customer' },
    nested: {
      authorization: 'Bearer private-token',
      api_key: 'private-key',
    },
  }) as Record<string, unknown>;

  assert.equal(sanitized.email, 'allowed@example.com');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.requestBody, '[REDACTED]');
  assert.deepEqual(sanitized.nested, {
    authorization: '[REDACTED]',
    api_key: '[REDACTED]',
  });
}

