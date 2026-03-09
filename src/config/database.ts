import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { env } from './env';

// Prisma Client会自动从process.env.DATABASE_URL读取
// 确保使用正确的DATABASE_URL
const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL || 'postgresql://postgres:123456@localhost:5432/auth_db';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

// 开发环境：记录使用的数据库URL（隐藏密码）
if (env.NODE_ENV === 'development') {
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  logger.info(`📊 Using database: ${maskedUrl}`);
}

const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development'
    ? ['error', 'warn']
    : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

// 延迟连接数据库（只在需要时连接）
// 开发环境：连接失败时不退出，只记录警告
if (env.NODE_ENV === 'development') {
  prisma.$connect()
    .then(() => {
      logger.info('✅ Database connected successfully');
    })
    .catch((error: any) => {
      // 提取错误消息 - Prisma错误可能有特殊的结构
      let errorMessage = 'Unknown error';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.toString && typeof error.toString === 'function') {
        errorMessage = error.toString();
      } else {
        // 尝试从错误对象中提取消息
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Database connection failed';
        }
      }
      logger.warn(`⚠️ Database connection failed (continuing in dev mode): ${errorMessage}`);
      logger.warn('⚠️ Some features may not work without database connection');
    });
} else {
  // 生产环境：连接失败时退出
  prisma.$connect()
    .then(() => {
      logger.info('✅ Database connected successfully');
    })
    .catch((error: any) => {
      let errorMessage = 'Unknown error';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.toString && typeof error.toString === 'function') {
        errorMessage = error.toString();
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Database connection failed';
        }
      }
      logger.error(`❌ Database connection failed: ${errorMessage}`);
      process.exit(1);
    });
}

// 优雅关闭
process.on('beforeExit', async () => {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    // 忽略关闭时的错误
  }
});

export default prisma;
