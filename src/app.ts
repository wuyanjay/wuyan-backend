import Koa from 'koa';
import { koaBody } from 'koa-body';
import serve from 'koa-static';
import mount from 'koa-mount';
import helmet from 'koa-helmet';
import cors from '@koa/cors';
import { logger } from './utils/logger';
import { errorMiddleware } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import tagRoutes from './routes/tag.routes';
import likeRoutes from './routes/like.routes';
import commentRoutes from './routes/comment.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import itemRoutes from './routes/item.routes';
import statsRoutes from './routes/stats.routes';
import subscriptionRoutes from './routes/subscription.routes';
import { env } from './config/env';
import { UPLOAD_CONFIG } from './config/upload.config';

const app = new Koa();

// 请求日志（放最前面，确保错误也能记录到最终status）
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info(`${ctx.method} ${ctx.url} - ${ctx.status} - ${ms}ms`);
});

// 错误处理（必须在路由之前，才能捕获 downstream 的 throw）
app.use(errorMiddleware);

// 安全头
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com/recaptcha/"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"], // Added blob: just in case
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["https://www.google.com/recaptcha/"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));

// 静态文件服务
// 挂载到 /uploads 路径
app.use(mount('/uploads', serve(UPLOAD_CONFIG.uploadDir)));

// Body parser
app.use(koaBody({
  multipart: true,
  jsonLimit: '10mb',
  formidable: {
    maxFileSize: UPLOAD_CONFIG.maxFileSize,
    keepExtensions: true,
  }
}));

// 路由
app.use(authRoutes.routes());
app.use(authRoutes.allowedMethods());

app.use(postRoutes.routes());
app.use(postRoutes.allowedMethods());

app.use(tagRoutes.routes());
app.use(tagRoutes.allowedMethods());

app.use(likeRoutes.routes());
app.use(likeRoutes.allowedMethods());

app.use(commentRoutes.routes());
app.use(commentRoutes.allowedMethods());

app.use(userRoutes.routes());
app.use(userRoutes.allowedMethods());

app.use(uploadRoutes.routes());
app.use(uploadRoutes.allowedMethods());

app.use(itemRoutes.routes());
app.use(itemRoutes.allowedMethods());

app.use(statsRoutes.routes());
app.use(statsRoutes.allowedMethods());

app.use(subscriptionRoutes.routes());
app.use(subscriptionRoutes.allowedMethods());

// 404 兜底
app.use(async (ctx) => {
  if (ctx.status === 404 && !ctx.body) {
    ctx.body = {
      success: false,
      error: 'NOT_FOUND',
      message: '接口不存在'
    };
  }
});

export default app;
