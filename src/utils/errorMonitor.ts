/**
 * Optional Production Error Monitoring
 *
 * Activated only when ERROR_MONITORING_DSN is set to a valid URL.
 * When the variable is absent the module is a complete no-op — the app
 * builds and runs identically without it.
 *
 * Scrubs all sensitive fields before the payload leaves the process so that
 * authorization headers, cookies, passwords, tokens, request bodies,
 * payment proofs, and provider secrets are never transmitted.
 */

import { sensitiveField } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonitorEvent {
  level: 'error' | 'warning';
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  request_id?: string;
  extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true only when DSN is set to a syntactically valid URL. */
export function isEnabled(): boolean {
  const dsn = process.env.ERROR_MONITORING_DSN;
  if (!dsn) return false;
  try {
    new URL(dsn);
    return true;
  } catch {
    return false;
  }
}

/** Recursively redact sensitive keys, mirroring logger.ts sanitizeLogValue. */
export function scrubPayload(value: unknown, key = '', depth = 0): unknown {
  if (key && sensitiveField.test(key)) return '[REDACTED]';
  if (depth > 5) return '[TRUNCATED]';
  if (value instanceof Error) {
    return { name: value.name, message: value.message, ...(value.stack ? { stack: value.stack } : {}) };
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubPayload(item, '', depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        scrubPayload(v, k, depth + 1),
      ])
    );
  }
  return value;
}

/** Fire-and-forget HTTP POST. Swallows all errors so monitoring never breaks the app. */
async function send(event: MonitorEvent): Promise<void> {
  const dsn = process.env.ERROR_MONITORING_DSN!;
  try {
    await fetch(dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      // Use a short signal timeout so a dead endpoint doesn't block the process.
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Intentionally silent — monitoring must never crash the app.
  }
}

function buildEvent(
  level: MonitorEvent['level'],
  err: unknown,
  extra: Record<string, unknown> = {}
): MonitorEvent {
  const scrubbedExtra = scrubPayload(extra) as Record<string, unknown>;

  let message: string;
  let errorDetails: Record<string, unknown> | undefined;

  if (err instanceof Error) {
    message = err.message;
    errorDetails = scrubPayload(err) as Record<string, unknown>;
  } else if (typeof err === 'string') {
    message = err;
  } else {
    message = 'Unknown error';
    errorDetails = scrubPayload(err) as Record<string, unknown>;
  }

  const request_id =
    typeof scrubbedExtra['request_id'] === 'string'
      ? (scrubbedExtra['request_id'] as string)
      : undefined;

  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'hall-sync-backend',
    environment: process.env.NODE_ENV || 'development',
    ...(request_id ? { request_id } : {}),
    extra: {
      ...(errorDetails ? { error: errorDetails } : {}),
      ...scrubbedExtra,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture an error and forward it to the monitoring endpoint (if configured).
 * Safe to call unconditionally — no-op when DSN is not set.
 */
export function captureError(
  err: unknown,
  extra: Record<string, unknown> = {}
): void {
  if (!isEnabled()) return;
  const event = buildEvent('error', err, extra);
  void send(event);
}

/**
 * Capture a warning message and forward it to the monitoring endpoint.
 * Safe to call unconditionally — no-op when DSN is not set.
 */
export function captureMessage(
  message: string,
  extra: Record<string, unknown> = {}
): void {
  if (!isEnabled()) return;
  const event = buildEvent('warning', message, extra);
  void send(event);
}
