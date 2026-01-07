/**
 * Request Logger Middleware
 * Logs all incoming HTTP requests
 */

import { Request, Response, NextFunction } from 'express';

import { logger, IdGenerator } from '@saveit/utils';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = req.get('x-request-id') || IdGenerator.requestId();

  // Set request ID for tracking
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
}
