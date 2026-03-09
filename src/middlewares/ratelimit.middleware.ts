import { Context, Next } from 'koa';
import redis from '../config/redis';
import { RateLimitError } from '../errors/custom-errors';

interface RateLimitConfig {
  windowMs: number;   // 时间窗口(毫秒)
  maxRequests: number; // 最大请求数
  keyGenerator?: (ctx: Context) => string; // 自定义key生成器
}

export const rateLimitMiddleware = (config: RateLimitConfig) => {
  return async (ctx: Context, next: Next) => {
    const key = config.keyGenerator
      ? config.keyGenerator(ctx)
      : `ratelimit:${ctx.ip}`;

    const windowKey = `${key}:${Math.floor(Date.now() / config.windowMs)}`;

    const count = await redis.incr(windowKey);

    if (count === 1) {
      await redis.expire(windowKey, Math.ceil(config.windowMs / 1000));
    }

    const remaining = Math.max(0, config.maxRequests - count);
    const resetAt = Math.ceil(Date.now() / config.windowMs) * config.windowMs;

    ctx.set('X-RateLimit-Limit', config.maxRequests.toString());
    ctx.set('X-RateLimit-Remaining', remaining.toString());
    ctx.set('X-RateLimit-Reset', resetAt.toString());

    if (count > config.maxRequests) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      ctx.set('Retry-After', retryAfter.toString());
      throw new RateLimitError(
        `请求过于频繁，请在 ${retryAfter} 秒后重试。`,
        { retryAfter }
      );
    }

    await next();
  };
};

// 预定义限流器
export const loginRateLimiter = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15分钟
  maxRequests: 5,
  keyGenerator: (ctx) => {
    const body = ctx.request.body as any;
    return `login:${body?.email || ctx.ip}`;
  }
});

export const registerRateLimiter = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 10000,
  keyGenerator: (ctx) => `register:${ctx.ip}`
});

export const emailRateLimiter = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 3,
  keyGenerator: (ctx) => `email:${ctx.state.user?.id || ctx.ip}`
});

// 忘记密码：3次/小时/IP
export const forgotPasswordRateLimiter = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 3,
  keyGenerator: (ctx) => `forgot-password:${ctx.ip}`
});

// 忘记密码（针对邮箱）：5次/小时/邮箱
export const forgotPasswordEmailRateLimiter = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 5,
  keyGenerator: (ctx) => {
    const email = ctx.request.body && typeof ctx.request.body === 'object' && 'email' in ctx.request.body 
      ? (ctx.request.body as any).email 
      : 'unknown';
    // 防止数组 key
    const safeEmail = Array.isArray(email) ? email[0] : email;
    return `forgot-password-email:${safeEmail}`;
  }
});

// 重置密码：5次/15分钟/IP
export const resetPasswordRateLimiter = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15分钟
  maxRequests: 5,
  keyGenerator: (ctx) => `reset-password:${ctx.ip}`
});
