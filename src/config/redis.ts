import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { env } from './env';

const redis = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: true, // 延迟连接
});

redis.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redis.on('error', (error: any) => {
  const errorMessage = error?.message || error?.toString() || String(error);
  if (env.NODE_ENV === 'development') {
    logger.warn(`⚠️ Redis connection error (continuing in dev mode): ${errorMessage}`);
  } else {
    logger.error(`❌ Redis connection error: ${errorMessage}`);
  }
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// 尝试连接（开发环境失败时不退出）
if (env.NODE_ENV === 'development') {
  redis.connect().catch((error: any) => {
    const errorMessage = error?.message || error?.toString() || String(error);
    logger.warn(`⚠️ Redis connection failed (continuing in dev mode): ${errorMessage}`);
    logger.warn('⚠️ Some features may not work without Redis connection');
  });
} else {
  redis.connect().catch((error: any) => {
    const errorMessage = error?.message || error?.toString() || String(error);
    logger.error(`❌ Redis connection failed: ${errorMessage}`);
    process.exit(1);
  });
}

// 优雅关闭
process.on('beforeExit', async () => {
  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    // 忽略关闭时的错误
  }
});

export default redis;