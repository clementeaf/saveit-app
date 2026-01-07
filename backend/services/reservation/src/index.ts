/**
 * Reservation Service - Entry Point
 */

import express from 'express';
import dotenv from 'dotenv';
import { db } from '@saveit/database';
import { cache } from '@saveit/cache';
import { errorHandler, requestLogger, corsMiddleware } from '@saveit/middleware';
import { logger } from '@saveit/utils';

import reservationRoutes from './routes/reservationRoutes';
import healthRoutes from './routes/healthRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsMiddleware);
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/reservations', reservationRoutes);

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Graceful shutdown initiated...');
  
  try {
    // Close database connections
    await db.close();
    logger.info('Database connections closed');
    
    // Close Redis connections
    await cache.disconnect();
    logger.info('Redis connections closed');
    
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
    // Connect to Redis
    await cache.connect();
    logger.info('Redis connected');
    
    // Test database connection
    const dbHealth = await db.healthCheck();
    if (!dbHealth.healthy) {
      throw new Error('Database connection failed');
    }
    logger.info('Database connected');
    
    app.listen(PORT, () => {
      logger.info(`Reservation service listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

startServer();

export default app;
