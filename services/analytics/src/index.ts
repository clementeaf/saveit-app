/**
 * Analytics Service - Entry Point
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { db } from '@saveit/database';
import { errorHandler, requestLogger, corsMiddleware, asyncHandler } from '@saveit/middleware';
import { logger } from '@saveit/utils';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsMiddleware);
app.use(requestLogger);

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await db.healthCheck();
    const status = dbHealth.healthy ? 'healthy' : 'unhealthy';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      service: 'analytics-service',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date(),
      dependencies: {
        database: {
          status: dbHealth.healthy ? 'up' : 'down',
          latency: dbHealth.latency,
        },
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'analytics-service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get restaurant metrics
app.get(
  '/api/analytics/restaurants/:restaurantId/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    const { startDate, endDate } = req.query;

    logger.info('Getting restaurant metrics', { restaurantId, startDate, endDate });

    // In a real system, this would aggregate data from reservations, messages, etc.
    const query = `
      SELECT
        COUNT(*) as total_reservations,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_reservations,
        COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as checked_in_reservations,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_reservations,
        AVG(party_size) as avg_party_size,
        MAX(party_size) as max_party_size,
        MIN(party_size) as min_party_size
      FROM reservations
      WHERE restaurant_id = $1
        AND date >= COALESCE($2::date, CURRENT_DATE - INTERVAL '30 days')
        AND date <= COALESCE($3::date, CURRENT_DATE)
    `;

    const client = await db.getClient();
    try {
      const result = await client.query(query, [restaurantId, startDate, endDate]);

      res.status(200).json({
        success: true,
        data: {
          restaurantId,
          period: {
            startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: endDate || new Date(),
          },
          metrics: result.rows[0],
        },
        timestamp: new Date(),
      });
    } finally {
      client.release();
    }
  })
);

// Get reservation stats
app.get(
  '/api/analytics/reservations/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    logger.info('Getting reservation stats', { startDate, endDate });

    const query = `
      SELECT
        DATE(date) as reservation_date,
        COUNT(*) as total_reservations,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as checked_in,
        AVG(party_size) as avg_party_size
      FROM reservations
      WHERE date >= COALESCE($1::date, CURRENT_DATE - INTERVAL '30 days')
        AND date <= COALESCE($2::date, CURRENT_DATE)
      GROUP BY DATE(date)
      ORDER BY reservation_date DESC
    `;

    const client = await db.getClient();
    try {
      const result = await client.query(query, [startDate, endDate]);

      res.status(200).json({
        success: true,
        data: {
          period: {
            startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: endDate || new Date(),
          },
          stats: result.rows,
        },
        timestamp: new Date(),
      });
    } finally {
      client.release();
    }
  })
);

// Get channel metrics
app.get(
  '/api/analytics/channels/metrics',
  asyncHandler(async (_req: Request, res: Response) => {
    logger.info('Getting channel metrics');

    const query = `
      SELECT
        channel,
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_users
      FROM messages
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY channel
      ORDER BY total_messages DESC
    `;

    const client = await db.getClient();
    try {
      const result = await client.query(query);

      res.status(200).json({
        success: true,
        data: {
          period: {
            days: 30,
          },
          channelMetrics: result.rows,
        },
        timestamp: new Date(),
      });
    } finally {
      client.release();
    }
  })
);

// Get top restaurants
app.get(
  '/api/analytics/restaurants/top',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query;

    logger.info('Getting top restaurants');

    const query = `
      SELECT
        r.id,
        r.name,
        COUNT(res.id) as total_reservations,
        COUNT(CASE WHEN res.status = 'checked_in' THEN 1 END) as checked_in_count,
        ROUND(
          100.0 * COUNT(CASE WHEN res.status = 'checked_in' THEN 1 END) / 
          NULLIF(COUNT(res.id), 0),
          2
        ) as check_in_rate
      FROM restaurants r
      LEFT JOIN reservations res ON r.id = res.restaurant_id
        AND res.date >= CURRENT_DATE - INTERVAL '30 days'
      WHERE r.is_active = TRUE
      GROUP BY r.id, r.name
      ORDER BY total_reservations DESC
      LIMIT $1
    `;

    const client = await db.getClient();
    try {
      const result = await client.query(query, [limit ? parseInt(limit as string, 10) : 10]);

      res.status(200).json({
        success: true,
        data: {
          period: {
            days: 30,
          },
          topRestaurants: result.rows,
        },
        timestamp: new Date(),
      });
    } finally {
      client.release();
    }
  })
);

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Graceful shutdown initiated...');

  try {
    await db.close();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error instanceof Error ? error : undefined);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer() {
  try {
    const dbHealth = await db.healthCheck();
    if (!dbHealth.healthy) {
      throw new Error('Database connection failed');
    }
    logger.info('Database connected');

    app.listen(PORT, () => {
      logger.info(`Analytics service listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

startServer();

export default app;
