/**
 * Channel Gateway Service - Entry Point
 */

import express, { type Request, type Response } from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { db } from '@saveit/database';
import { errorHandler, requestLogger, corsMiddleware, asyncHandler } from '@saveit/middleware';
import { logger } from '@saveit/utils';
import { ChannelGateway } from './services/channelGateway';

// Load environment variables from multiple locations
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config(); // Also try default locations

const app = express();
const PORT = process.env.PORT || 3004;
const gateway = new ChannelGateway();

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
      service: 'channel-gateway',
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
      service: 'channel-gateway',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Handle incoming messages
app.post(
  '/api/channels/incoming',
  asyncHandler(async (req: Request, res: Response) => {
    const { channelId, userId, channel, content, metadata } = req.body;

    if (!channelId || !userId || !channel || !content) {
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

    const message = await gateway.handleIncomingMessage({
      channelId,
      userId,
      channel,
      content,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: message,
      timestamp: new Date(),
    });
  })
);

// Send message to channel
app.post(
  '/api/channels/send',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, channel, content, metadata } = req.body;

    if (!userId || !channel || !content) {
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

    const message = await gateway.sendToChannel({
      userId,
      channel,
      content,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: message,
      timestamp: new Date(),
    });
  })
);

// Get conversation history
app.get(
  '/api/channels/:userId/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { limit } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameter: userId',
        },
        timestamp: new Date(),
      });
      return;
    }

    const messageLimit = (limit && typeof limit === 'string') ? parseInt(limit, 10) : 50;
    const messages = await gateway.getConversationHistory(
      userId,
      messageLimit
    );

    res.status(200).json({
      success: true,
      data: messages,
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
      logger.info(`Channel Gateway listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

startServer();

export default app;
