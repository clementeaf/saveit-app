/**
 * Error Handler Middleware
 * Centralized error handling for Express applications
 */

import { Request, Response, NextFunction } from 'express';

import { AppError, ErrorCode } from '@saveit/types';
import { logger } from '@saveit/utils';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Log the error
  const context: Record<string, unknown> = {
    method: req.method,
    path: req.path,
  };
  const requestId = req.get('x-request-id');
  if (requestId) context.requestId = requestId;
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) context.userId = userId;
  
  logger.error('Request error', err, context);

  // Handle AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      timestamp: new Date(),
    });
    return;
  }

  // Handle other known errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: err.message,
      },
      timestamp: new Date(),
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      success: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: 'Unauthorized',
      },
      timestamp: new Date(),
    });
    return;
  }

  // Handle unknown errors (don't expose internal details)
  res.status(500).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
    timestamp: new Date(),
  });
}
