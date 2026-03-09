import { Context, Next } from 'koa';
import { JwtUtil } from '../utils/jwt.util';
import redis from '../config/redis';
import { UnauthorizedError } from '../errors/custom-errors';

export const authMiddleware = async (ctx: Context, next: Next) => {
  const authHeader = ctx.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('未提供访问令牌', 'NO_ACCESS_TOKEN');
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = JwtUtil.verifyAccessToken(token);
    
    // 检查session是否仍然有效
    const sessionExists = await redis.exists(`session:${payload.sessionId}`);
    if (!sessionExists) {
      throw new UnauthorizedError('会话已过期或无效', 'SESSION_EXPIRED');
    }
    
    // 将用户信息附加到context
    ctx.state.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      sessionId: payload.sessionId
    };
    
    await next();
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('访问令牌已过期', 'ACCESS_TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('访问令牌无效', 'INVALID_ACCESS_TOKEN');
    }
    throw error;
  }
};

/**
 * 可选认证：有有效 token 时写入 ctx.state.user，无 token 或无效时不抛错、直接放行。
 * 用于“需区分是否登录但不强制登录”的接口（如按 ID 获取文章详情并记录浏览）。
 */
export const optionalAuthMiddleware = async (ctx: Context, next: Next) => {
  const authHeader = ctx.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await next();
    return;
  }
  const token = authHeader.substring(7);
  try {
    const payload = JwtUtil.verifyAccessToken(token);
    const sessionExists = await redis.exists(`session:${payload.sessionId}`);
    if (!sessionExists) {
      await next();
      return;
    }
    ctx.state.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      sessionId: payload.sessionId
    };
  } catch {
    // token 无效或过期时不抛错，仅不设置 user
  }
  await next();
};
