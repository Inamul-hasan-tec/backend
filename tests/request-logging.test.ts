import assert from 'assert';
import { EventEmitter } from 'events';
import { NextFunction, Request, Response } from 'express';
import { requestLogger } from '../src/middleware/logger';

class MockResponse extends EventEmitter {
  statusCode = 200;
  headers = new Map<string, string>();

  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }
}

function mockRequest(suppliedRequestId?: string): Request {
  return {
    method: 'GET',
    url: '/health',
    originalUrl: '/api/health',
    header: (name: string) =>
      name.toLowerCase() === 'x-request-id' ? suppliedRequestId : undefined,
  } as Request;
}

export function testRequestLogging(): void {
  const request = mockRequest('acceptance-request-123');
  const response = new MockResponse();
  let nextCalled = false;

  requestLogger(
    request,
    response as unknown as Response,
    (() => {
      nextCalled = true;
    }) as NextFunction
  );

  assert.equal(nextCalled, true);
  assert.equal(request.requestId, 'acceptance-request-123');
  assert.equal(response.headers.get('x-request-id'), 'acceptance-request-123');

  response.emit('finish');

  const untrustedLongId = 'x'.repeat(129);
  const generatedRequest = mockRequest(untrustedLongId);
  const generatedResponse = new MockResponse();

  requestLogger(
    generatedRequest,
    generatedResponse as unknown as Response,
    (() => undefined) as NextFunction
  );

  assert.notEqual(generatedRequest.requestId, untrustedLongId);
  assert.match(generatedRequest.requestId || '', /^[0-9a-f-]{36}$/i);
  assert.equal(
    generatedResponse.headers.get('x-request-id'),
    generatedRequest.requestId
  );
}

