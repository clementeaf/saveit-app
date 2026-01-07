/**
 * Health Check Routes
 */

import { Router, Request, Response } from 'express';
import { db } from '@saveit/database';
import { cache } from '@saveit/cache';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await db.healthCheck();
    const redisHealth = await cache.healthCheck();

    const status = dbHealth.healthy && redisHealth.healthy ? 'healthy' : 'unhealthy';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      service: 'reservation-service',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date(),
      dependencies: {
        database: {
          status: dbHealth.healthy ? 'up' : 'down',
          latency: dbHealth.latency,
        },
        redis: {
          status: redisHealth.healthy ? 'up' : 'down',
          latency: redisHealth.latency,
        },
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'reservation-service',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
