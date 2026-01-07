/**
 * Notification Service - Entry Point
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { db } from '@saveit/database';
import { errorHandler, requestLogger, corsMiddleware, asyncHandler } from '@saveit/middleware';
import { logger } from '@saveit/utils';
import { NotificationService } from './services/notificationService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const notificationService = new NotificationService();

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
      service: 'notification-service',
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
      service: 'notification-service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Send notification endpoint
app.post(
  '/api/notifications/send',
  asyncHandler(async (req: Request, res: Response) => {
    const { reservationId, userId, channel, type, data } = req.body;

    if (!reservationId || !userId || !channel || !type) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters',
        },
        timestamp: new Date(),
      });
      return;
    }

    const notification = await notificationService.sendNotification({
      reservationId,
      userId,
      channel,
      type,
      data,
    });

    res.status(201).json({
      success: true,
      data: notification,
      timestamp: new Date(),
    });
  })
);

// Get notification history
app.get(
  '/api/notifications/:reservationId/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { reservationId } = req.params;

    if (!reservationId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameter: reservationId',
        },
        timestamp: new Date(),
      });
      return;
    }

    const notifications = await notificationService.getNotificationHistory(reservationId);

    res.status(200).json({
      success: true,
      data: notifications,
      timestamp: new Date(),
    });
  })
);

// Send confirmation
app.post(
  '/api/notifications/confirmation',
  asyncHandler(async (req: Request, res: Response) => {
    const { reservationId, userId, channel, data } = req.body;

    const notification = await notificationService.sendConfirmation(
      reservationId,
      userId,
      channel,
      data
    );

    res.status(201).json({
      success: true,
      data: notification,
      timestamp: new Date(),
    });
  })
);

// Send reminder
app.post(
  '/api/notifications/reminder',
  asyncHandler(async (req: Request, res: Response) => {
    const { reservationId, userId, channel, data } = req.body;

    const notification = await notificationService.sendReminder(
      reservationId,
      userId,
      channel,
      data
    );

    res.status(201).json({
      success: true,
      data: notification,
      timestamp: new Date(),
    });
  })
);

// Send cancellation
app.post(
  '/api/notifications/cancellation',
  asyncHandler(async (req: Request, res: Response) => {
    const { reservationId, userId, channel, data } = req.body;

    const notification = await notificationService.sendCancellation(
      reservationId,
      userId,
      channel,
      data
    );

    res.status(201).json({
      success: true,
      data: notification,
      timestamp: new Date(),
    });
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
      logger.info(`Notification service listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

startServer();

export default app;
