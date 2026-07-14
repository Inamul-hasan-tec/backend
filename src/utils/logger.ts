type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;

declare global {
  // eslint-disable-next-line no-var
  var __hallSyncStructuredConsoleInstalled: boolean | undefined;
}

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export const sensitiveField = /password|token|authorization|cookie|secret|api[_-]?key|body|payment|proof|provider/i;

function minimumPriority(): number {
  const configuredLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase();
  return levelPriority[configuredLevel as LogLevel] || levelPriority.info;
}

function normalizeError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
  };
}

export function sanitizeLogValue(
  value: unknown,
  key = '',
  depth = 0
): unknown {
  if (key && sensitiveField.test(key)) return '[REDACTED]';
  if (depth > 5) return '[TRUNCATED]';
  if (value instanceof Error) return normalizeError(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, '', depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeLogValue(childValue, childKey, depth + 1),
      ])
    );
  }
  return value;
}

function normalizeFields(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, sanitizeLogValue(value, key)])
  );
}

function write(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (levelPriority[level] < minimumPriority()) {
    return;
  }

  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: 'hall-sync-backend',
    environment: process.env.NODE_ENV || 'development',
    ...normalizeFields(fields),
  };

  const line = JSON.stringify(record, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  debug: (event: string, fields?: LogFields) => write('debug', event, fields),
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields),
};

function legacyMessage(args: unknown[]): string {
  return args
    .map((value) => {
      if (value instanceof Error) return value.message;
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(sanitizeLogValue(value));
      } catch {
        return String(value);
      }
    })
    .join(' ');
}

/**
 * Keeps legacy call sites machine-readable in production while they are
 * gradually migrated to named logger events. Routine console.log noise is
 * debug-level and therefore suppressed by the default LOG_LEVEL=info.
 */
export function installStructuredConsoleBridge(): void {
  if (
    process.env.NODE_ENV !== 'production' ||
    globalThis.__hallSyncStructuredConsoleInstalled
  ) {
    return;
  }

  globalThis.__hallSyncStructuredConsoleInstalled = true;
  console.log = (...args: unknown[]) =>
    write('debug', 'legacy_console', { message: legacyMessage(args) });
  console.info = (...args: unknown[]) =>
    write('info', 'legacy_console', { message: legacyMessage(args) });
  console.warn = (...args: unknown[]) =>
    write('warn', 'legacy_console', { message: legacyMessage(args) });
  console.error = (...args: unknown[]) =>
    write('error', 'legacy_console', { message: legacyMessage(args) });
}
