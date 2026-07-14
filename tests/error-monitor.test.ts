/**
 * Error Monitor — Deterministic Initialization & Scrubbing Tests
 *
 * All checks are synchronous and require no network access.
 * Tests cover:
 *   1. DSN unset  → isEnabled() false, captureError() does not throw
 *   2. DSN invalid → isEnabled() false
 *   3. DSN valid URL → isEnabled() true
 *   4. Scrubbing of every sensitive category
 *   5. Safe (non-sensitive) keys pass through unchanged
 */

import assert from 'assert';
import { isEnabled, scrubPayload } from '../src/utils/errorMonitor';

// ---------------------------------------------------------------------------
// Helpers to safely toggle the env var within a test
// ---------------------------------------------------------------------------

function withDsn<T>(dsn: string | undefined, fn: () => T): T {
  const previous = process.env.ERROR_MONITORING_DSN;
  if (dsn === undefined) {
    delete process.env.ERROR_MONITORING_DSN;
  } else {
    process.env.ERROR_MONITORING_DSN = dsn;
  }
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.ERROR_MONITORING_DSN;
    } else {
      process.env.ERROR_MONITORING_DSN = previous;
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function testErrorMonitor(): void {
  // 1. DSN unset → disabled
  withDsn(undefined, () => {
    assert.strictEqual(
      isEnabled(),
      false,
      'isEnabled() must return false when ERROR_MONITORING_DSN is unset'
    );
  });

  // 2. DSN present but not a valid URL → disabled
  withDsn('not-a-url', () => {
    assert.strictEqual(
      isEnabled(),
      false,
      'isEnabled() must return false when DSN is not a valid URL'
    );
  });

  withDsn('replace-with-provider-dsn', () => {
    assert.strictEqual(
      isEnabled(),
      false,
      'isEnabled() must return false for the placeholder string'
    );
  });

  // 3. DSN is a valid URL → enabled
  withDsn('https://ingest.example.com/api/123/envelope/', () => {
    assert.strictEqual(
      isEnabled(),
      true,
      'isEnabled() must return true when DSN is a syntactically valid URL'
    );
  });

  // 4a. Scrubbing — authorization headers
  {
    const result = scrubPayload({ authorization: 'Bearer secret-jwt' }) as Record<string, unknown>;
    assert.strictEqual(result['authorization'], '[REDACTED]', 'authorization must be scrubbed');
  }

  // 4b. Scrubbing — cookies
  {
    const result = scrubPayload({ cookie: 'session=abc123' }) as Record<string, unknown>;
    assert.strictEqual(result['cookie'], '[REDACTED]', 'cookie must be scrubbed');
  }

  // 4c. Scrubbing — passwords
  {
    const result = scrubPayload({ password: 'hunter2' }) as Record<string, unknown>;
    assert.strictEqual(result['password'], '[REDACTED]', 'password must be scrubbed');
  }

  // 4d. Scrubbing — tokens
  {
    const result = scrubPayload({ token: 'abc', refresh_token: 'xyz' }) as Record<string, unknown>;
    assert.strictEqual(result['token'], '[REDACTED]', 'token must be scrubbed');
    assert.strictEqual(result['refresh_token'], '[REDACTED]', 'refresh_token must be scrubbed');
  }

  // 4e. Scrubbing — request bodies
  {
    const result = scrubPayload({ body: { customer_name: 'Private' } }) as Record<string, unknown>;
    assert.strictEqual(result['body'], '[REDACTED]', 'body must be scrubbed');
  }

  // 4f. Scrubbing — payment proofs
  {
    const result = scrubPayload({
      payment_proof: 'cloudinary://...',
      paymentProof: 'data:image/png;base64,...',
    }) as Record<string, unknown>;
    assert.strictEqual(result['payment_proof'], '[REDACTED]', 'payment_proof must be scrubbed');
    assert.strictEqual(result['paymentProof'], '[REDACTED]', 'paymentProof must be scrubbed');
  }

  // 4g. Scrubbing — provider secrets
  {
    const result = scrubPayload({
      cloudinary_secret: 'abc',
      provider_key: 'xyz',
    }) as Record<string, unknown>;
    assert.strictEqual(result['cloudinary_secret'], '[REDACTED]', 'cloudinary_secret must be scrubbed');
    assert.strictEqual(result['provider_key'], '[REDACTED]', 'provider_key must be scrubbed');
  }

  // 4h. Scrubbing — nested sensitive fields
  {
    const result = scrubPayload({
      headers: { authorization: 'Bearer tok', 'x-request-id': 'req-123' },
    }) as Record<string, unknown>;
    const headers = result['headers'] as Record<string, unknown>;
    assert.strictEqual(headers['authorization'], '[REDACTED]', 'nested authorization must be scrubbed');
    assert.strictEqual(headers['x-request-id'], 'req-123', 'non-sensitive nested key must pass through');
  }

  // 5. Safe keys pass through unchanged
  {
    const result = scrubPayload({
      message: 'Something exploded',
      status: 500,
      request_id: 'req-abc-123',
      method: 'POST',
      path: '/api/bookings',
      user_id: 42,
    }) as Record<string, unknown>;
    assert.strictEqual(result['message'], 'Something exploded', 'message must not be scrubbed');
    assert.strictEqual(result['status'], 500, 'status must not be scrubbed');
    assert.strictEqual(result['request_id'], 'req-abc-123', 'request_id must not be scrubbed');
    assert.strictEqual(result['method'], 'POST', 'method must not be scrubbed');
    assert.strictEqual(result['path'], '/api/bookings', 'path must not be scrubbed');
    assert.strictEqual(result['user_id'], 42, 'user_id must not be scrubbed');
  }

  // 6. captureError() is safe to call unconditionally when DSN is unset
  withDsn(undefined, () => {
    assert.doesNotThrow(() => {
      // We can't import captureError directly here without triggering a module-level
      // fetch, so we import the real function and confirm it returns without throwing.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { captureError } = require('../src/utils/errorMonitor');
      captureError(new Error('test'), { request_id: 'r-1', password: 'should-be-scrubbed' });
    }, 'captureError must not throw when monitoring is disabled');
  });
}
