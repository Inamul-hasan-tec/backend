import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

interface RateLimitOptions {
  windowMs: number;
  maxIpFailures: number;
  maxAccountFailures: number;
  now?: () => number;
}

interface FailureBucket {
  count: number;
  resetAt: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function accountKey(email: unknown): string | null {
  if (typeof email !== 'string' || !email.trim()) return null;
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export function createLoginRateLimiter(options: RateLimitOptions) {
  const ipFailures = new Map<string, FailureBucket>();
  const accountFailures = new Map<string, FailureBucket>();
  const now = options.now || Date.now;
  let requestCount = 0;

  function activeBucket(map: Map<string, FailureBucket>, key: string, time: number) {
    const bucket = map.get(key);
    if (bucket && bucket.resetAt <= time) {
      map.delete(key);
      return undefined;
    }
    return bucket;
  }

  function recordFailure(map: Map<string, FailureBucket>, key: string, time: number) {
    const bucket = activeBucket(map, key, time);
    if (bucket) {
      bucket.count += 1;
    } else {
      map.set(key, { count: 1, resetAt: time + options.windowMs });
    }
  }

  function prune(time: number) {
    for (const [key, bucket] of ipFailures) {
      if (bucket.resetAt <= time) ipFailures.delete(key);
    }
    for (const [key, bucket] of accountFailures) {
      if (bucket.resetAt <= time) accountFailures.delete(key);
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const time = now();
    requestCount += 1;
    if (requestCount % 100 === 0) prune(time);

    const ipKey = req.ip || req.socket?.remoteAddress || 'unknown';
    const hashedAccount = accountKey(req.body?.email);
    const ipBucket = activeBucket(ipFailures, ipKey, time);
    const userBucket = hashedAccount
      ? activeBucket(accountFailures, hashedAccount, time)
      : undefined;
    const blockedBucket =
      (ipBucket && ipBucket.count >= options.maxIpFailures ? ipBucket : undefined) ||
      (userBucket && userBucket.count >= options.maxAccountFailures ? userBucket : undefined);

    if (blockedBucket) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((blockedBucket.resetAt - time) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('RateLimit-Reset', String(Math.ceil(blockedBucket.resetAt / 1000)));
      logger.warn('login_rate_limited', {
        request_id: req.requestId,
        ip: ipKey,
        account_hash: hashedAccount,
        retry_after_seconds: retryAfterSeconds,
      });
      res.status(429).json({
        success: false,
        message: 'Too many failed login attempts. Please try again later.',
      });
      return;
    }

    res.on('finish', () => {
      const completedAt = now();
      if (res.statusCode === 401) {
        recordFailure(ipFailures, ipKey, completedAt);
        if (hashedAccount) recordFailure(accountFailures, hashedAccount, completedAt);
      } else if (res.statusCode >= 200 && res.statusCode < 300 && hashedAccount) {
        accountFailures.delete(hashedAccount);
      }
    });

    next();
  };
}

export const loginRateLimiter = createLoginRateLimiter({
  windowMs: positiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  maxIpFailures: positiveInteger(process.env.LOGIN_RATE_LIMIT_MAX_IP_FAILURES, 20),
  maxAccountFailures: positiveInteger(process.env.LOGIN_RATE_LIMIT_MAX_ACCOUNT_FAILURES, 8),
});

