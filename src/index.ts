import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './utils/logger';
import prisma from './config/database';
import redis from './config/redis';
import { env } from './config/env';

const PORT = env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${env.NODE_ENV}`);
  logger.info(`🌐 API URL: ${env.API_URL}`);
  logger.info(`🔗 Frontend URL: ${env.FRONTEND_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');

  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database connections
    await prisma.$disconnect();
    await redis.quit();

    logger.info('Database connections closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');

  server.close(async () => {
    logger.info('HTTP server closed');

    await prisma.$disconnect();
    await redis.quit();

    logger.info('Database connections closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});