/**
 * Rate Limiting Middleware
 * Uses Redis to enforce rate limits
 */

import { Request, Response, NextFunction } from 'express';

import { AppError, ErrorCode } from '@saveit/types';
import { cache, CacheKeys } from '@saveit/cache';
import { logger } from '@saveit/utils';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Rate limit middleware factory
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = keyGenerator(req);
      const key = CacheKeys.rateLimit(identifier, req.path);

      // Get current count
      const currentStr = await cache.get<string>(key);
      const current = currentStr ? parseInt(currentStr, 10) : 0;

      if (current >= maxRequests) {
        logger.warn('Rate limit exceeded', {
          identifier,
          path: req.path,
          current,
          max: maxRequests,
        });

        throw new AppError(
          ErrorCode.FORBIDDEN,
          'Too many requests, please try again later',
          429,
          {
            limit: maxRequests,
            windowMs,
            retryAfter: Math.ceil(windowMs / 1000),
          }
        );
      }

      // Increment counter
      const newCount = await cache.incr(key);

      // Set expiry on first request
      if (newCount === 1) {
        await cache.expire(key, Math.ceil(windowMs / 1000));
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount));
      res.setHeader('X-RateLimit-Reset', Date.now() + windowMs);

      // Track response to potentially decrement counter
      if (skipSuccessfulRequests || skipFailedRequests) {
        res.on('finish', async () => {
          const shouldSkip =
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            await cache.decr(key);
          }
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Strict rate limit for sensitive operations
 */
export function strictRateLimit(req: Request, res: Response, next: NextFunction): void {
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (req) => {
      const userId = (req as Request & { userId?: string }).userId;
      return userId || req.ip || 'unknown';
    },
  })(req, res, next);
}

/**
 * Standard rate limit for API endpoints
 */
export function standardRateLimit(req: Request, res: Response, next: NextFunction): void {
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60,
    keyGenerator: (req) => {
      const userId = (req as Request & { userId?: string }).userId;
      return userId || req.ip || 'unknown';
    },
  })(req, res, next);
}
