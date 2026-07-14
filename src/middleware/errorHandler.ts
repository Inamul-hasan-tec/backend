/**
 * Error Handling Middleware
 * Catches and formats all errors
 */

import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { captureError } from '../utils/errorMonitor';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handler
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || inferStatusCode(err.message);
  const message = err.message || 'Internal Server Error';
  
  const errorContext = {
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    status: statusCode,
    user_id: req.user?.id,
    tenant_id: req.tenantId || req.user?.tenant_id,
    error: err,
  };

  logger.error('request_failed', errorContext);

  // Forward to error monitoring (no-op when ERROR_MONITORING_DSN is unset)
  captureError(err, {
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    status: statusCode,
    user_id: req.user?.id,
    tenant_id: req.tenantId || req.user?.tenant_id,
  });

  res.status(statusCode).json(
    errorResponse(
      message,
      process.env.NODE_ENV === 'production' ? undefined : err.stack
    )
  );
}

function inferStatusCode(message = ''): number {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('already booked') ||
    normalized.includes('already exists') ||
    normalized.includes('already been recorded') ||
    normalized.includes('already in use') ||
    normalized.includes('no longer available')
  ) {
    return 409;
  }

  if (
    normalized.includes('missing required') ||
    normalized.includes('invalid ') ||
    normalized.includes('must be') ||
    normalized.includes('cannot ') ||
    normalized.includes('exceeds') ||
    normalized.includes('not available')
  ) {
    return 400;
  }

  return 500;
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json(
    errorResponse(`Route ${req.url} not found`)
  );
}

/**
 * Async error wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
