/**
 * Optional Production Error Monitoring — Sentry backend adapter.
 *
 * Activated only when ERROR_MONITORING_DSN is set to a valid URL.
 * Monitoring is intentionally best-effort: it must never block, crash, or slow
 * down the booking/payment system.
 *
 * Sensitive fields are recursively scrubbed before an event leaves the process.
 */

import * as Sentry from '@sentry/node';
import type { ErrorEvent, EventHint } from '@sentry/node';
import { sensitiveField } from './logger';

let initialized = false;

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

export function scrubPayload(value: unknown, key = '', depth = 0): unknown {
  if (key && sensitiveField.test(key)) return '[REDACTED]';
  if (depth > 6) return '[TRUNCATED]';

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubPayload(item, '', depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        scrubPayload(childValue, childKey, depth + 1),
      ])
    );
  }

  return value;
}

function parseSampleRate(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function initErrorMonitor(): void {
  if (initialized || !isEnabled()) return;

  Sentry.init({
    dsn: process.env.ERROR_MONITORING_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_RELEASE || process.env.GIT_COMMIT_SHA,
    tracesSampleRate: parseSampleRate('SENTRY_TRACES_SAMPLE_RATE', 0),
    beforeSend(event: ErrorEvent, hint: EventHint) {
      const scrubbed = scrubPayload(event) as ErrorEvent;

      if (hint.originalException instanceof Error) {
        scrubbed.extra = {
          ...scrubbed.extra,
          original_error_name: hint.originalException.name,
        };
      }

      return scrubbed;
    },
  });

  initialized = true;
}

export function captureError(
  err: unknown,
  extra: Record<string, unknown> = {}
): void {
  if (!isEnabled()) return;
  initErrorMonitor();

  Sentry.withScope((scope) => {
    const scrubbedExtra = scrubPayload(extra) as Record<string, unknown>;

    if (typeof scrubbedExtra.request_id === 'string') {
      scope.setTag('request_id', scrubbedExtra.request_id);
    }
    if (typeof scrubbedExtra.tenant_id === 'number' || typeof scrubbedExtra.tenant_id === 'string') {
      scope.setTag('tenant_id', String(scrubbedExtra.tenant_id));
    }
    if (typeof scrubbedExtra.user_id === 'number' || typeof scrubbedExtra.user_id === 'string') {
      scope.setUser({ id: String(scrubbedExtra.user_id) });
    }

    scope.setExtras(scrubbedExtra);
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}

export function captureMessage(
  message: string,
  extra: Record<string, unknown> = {}
): void {
  if (!isEnabled()) return;
  initErrorMonitor();

  Sentry.withScope((scope) => {
    scope.setExtras(scrubPayload(extra) as Record<string, unknown>);
    Sentry.captureMessage(message, 'warning');
  });
}
