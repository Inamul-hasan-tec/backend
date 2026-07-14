/**
 * Request Logger Middleware
 * Logs all incoming requests
 */

import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const suppliedRequestId = req.header('x-request-id');
  const requestId = suppliedRequestId && suppliedRequestId.length <= 128
    ? suppliedRequestId
    : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const fields = {
      request_id: requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: duration,
      user_id: req.user?.id,
      tenant_id: req.tenantId || req.user?.tenant_id,
    };

    if (res.statusCode >= 500) {
      logger.error('http_request_completed', fields);
    } else if (res.statusCode >= 400) {
      logger.warn('http_request_completed', fields);
    } else {
      logger.info('http_request_completed', fields);
    }
  });

  next();
}
