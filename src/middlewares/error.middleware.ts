import { Context, Next } from 'koa';
import { logger } from '../utils/logger';
import {
  CustomError
} from '../errors/custom-errors';

const DEFAULT_ERROR_MESSAGE_ZH: Record<string, string> = {
  VALIDATION_ERROR: '参数校验失败',
  UNAUTHORIZED: '未授权',
  FORBIDDEN: '无权限访问',
  NOT_FOUND: '资源不存在',
  CONFLICT: '资源冲突',
  RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后再试',
  INTERNAL_SERVER_ERROR: '服务器内部错误',

  // 业务常用错误码（可按需继续补充）
  EMAIL_ALREADY_EXISTS: '该邮箱已被注册',
  USERNAME_ALREADY_EXISTS: '该用户名已被占用',
  INVALID_CREDENTIALS: '账号或密码错误',
  EMAIL_NOT_VERIFIED: '请先完成邮箱验证后再登录',
  ACCOUNT_LOCKED: '账号已被锁定，请稍后再试',
  INVALID_REFRESH_TOKEN: '刷新令牌无效或已过期',
  TOKEN_REUSE_DETECTED: '检测到令牌复用风险，已撤销所有会话',
  NO_REFRESH_TOKEN: '未找到刷新令牌',
  NO_ACCESS_TOKEN: '未提供访问令牌',
  ACCESS_TOKEN_EXPIRED: '访问令牌已过期',
  INVALID_ACCESS_TOKEN: '访问令牌无效',
  SESSION_EXPIRED: '会话已过期或无效',
  EMAIL_SEND_FAILED: '邮件发送失败，请稍后重试'
};

export const errorMiddleware = async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (error: any) {
    // 尝试解析 JSON 格式的错误信息（如 ZodError 的 message）
    let errorMsg = error.message;
    try {
      if (typeof errorMsg === 'string' && (errorMsg.startsWith('{') || errorMsg.startsWith('['))) {
        errorMsg = JSON.parse(errorMsg);
      }
    } catch (e) {
      // ignore parse error
    }

    // 记录错误
    logger.error('Error occurred:', {
      error: errorMsg,
      // stack: error.stack,
      path: ctx.path,
      method: ctx.method,
      ip: ctx.ip
    });

    // 自定义错误
    if (error instanceof CustomError) {
      ctx.status = error.statusCode;
      const rawMessage = typeof error.message === 'string' ? error.message.trim() : '';
      const hasZh = /[\u4e00-\u9fff]/.test(rawMessage);
      const message = hasZh
        ? rawMessage
        : (DEFAULT_ERROR_MESSAGE_ZH[error.code] ?? '请求失败');

      ctx.body = {
        success: false,
        error: error.code,
        message,
        ...(error.details && { details: error.details })
      };
      return;
    }

    // Zod验证错误
    if (error.name === 'ZodError') {
      const issues = error.issues ?? error.errors ?? [];
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: 'VALIDATION_ERROR',
        message: DEFAULT_ERROR_MESSAGE_ZH.VALIDATION_ERROR,
        details: issues.reduce((acc: any, err: any) => {
          const key = Array.isArray(err.path) && err.path.length > 0 ? err.path.join('.') : 'root';
          acc[key] = err.message;
          return acc;
        }, {})
      };
      return;
    }

    // Prisma错误
    if (error.code === 'P2002') {
      const fields = Array.isArray(error?.meta?.target) ? error.meta.target : undefined;
      ctx.status = 409;
      ctx.body = {
        success: false,
        error: 'CONFLICT',
        message: '资源已存在',
        ...(fields && { details: { fields } })
      };
      return;
    }

    // 默认500错误
    const isProd = process.env.NODE_ENV === 'production';
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: DEFAULT_ERROR_MESSAGE_ZH.INTERNAL_SERVER_ERROR,
      ...(!isProd && {
        debug: {
          message: error?.message,
          stack: error?.stack
        }
      })
    };
  }
};
