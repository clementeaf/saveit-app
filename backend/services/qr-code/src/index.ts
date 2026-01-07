/**
 * QR Code Service - Entry Point
 */

import express from 'express';
import dotenv from 'dotenv';
import { db } from '@saveit/database';
import { errorHandler, requestLogger, corsMiddleware } from '@saveit/middleware';
import { logger } from '@saveit/utils';

import qrRoutes from './routes/qrRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsMiddleware);
app.use(requestLogger);

// Health check
app.get('/health', async (_req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    const status = dbHealth.healthy ? 'healthy' : 'unhealthy';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      service: 'qr-code-service',
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
      service: 'qr-code-service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Routes
app.use('/api/qr', qrRoutes);

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
      logger.info(`QR Code service listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

startServer();

export default app;
