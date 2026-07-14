import assert from 'assert';
import { EventEmitter } from 'events';
import { NextFunction, Request, Response } from 'express';
import { createLoginRateLimiter } from '../src/middleware/loginRateLimiter';

class RateLimitResponse extends EventEmitter {
  statusCode = 200;
  headers = new Map<string, string>();
  body: unknown;

  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.body = body;
    return this;
  }
}

export function testLoginRateLimiter(): void {
  let currentTime = 1_000;
  const limiter = createLoginRateLimiter({
    windowMs: 10_000,
    maxIpFailures: 10,
    maxAccountFailures: 2,
    now: () => currentTime,
  });

  function attempt(email: string, ip: string, completedStatus = 401) {
    const request = {
      ip,
      socket: { remoteAddress: ip },
      body: { email },
      requestId: 'rate-limit-test',
    } as Request;
    const response = new RateLimitResponse();
    let nextCalled = false;

    limiter(
      request,
      response as unknown as Response,
      (() => {
        nextCalled = true;
      }) as NextFunction
    );

    if (nextCalled) {
      response.statusCode = completedStatus;
      response.emit('finish');
    }
    return { response, nextCalled };
  }

  assert.equal(attempt('Owner@HallSync.in', '10.0.0.1').nextCalled, true);
  assert.equal(attempt('owner@hallsync.in', '10.0.0.2').nextCalled, true);

  const blocked = attempt('OWNER@HALLSYNC.IN', '10.0.0.3');
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.response.statusCode, 429);
  assert.equal(blocked.response.headers.get('retry-after'), '10');

  currentTime += 10_001;
  assert.equal(attempt('owner@hallsync.in', '10.0.0.3').nextCalled, true);

  const resetLimiter = createLoginRateLimiter({
    windowMs: 10_000,
    maxIpFailures: 10,
    maxAccountFailures: 2,
    now: () => currentTime,
  });
  const resetRequest = {
    ip: '10.0.1.1',
    socket: { remoteAddress: '10.0.1.1' },
    body: { email: 'reset@hallsync.in' },
  } as Request;

  for (const status of [401, 200, 401]) {
    const response = new RateLimitResponse();
    let nextCalled = false;
    resetLimiter(
      resetRequest,
      response as unknown as Response,
      (() => {
        nextCalled = true;
      }) as NextFunction
    );
    assert.equal(nextCalled, true);
    response.statusCode = status;
    response.emit('finish');
  }
}

