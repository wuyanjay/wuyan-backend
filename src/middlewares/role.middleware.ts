import { Context, Next } from 'koa';
import { ForbiddenError } from '../errors/custom-errors';

/**
 * 角色权限中间件
 * @param allowedRoles 允许的角色列表
 */
export const roleMiddleware = (allowedRoles: string[]) => {
  return async (ctx: Context, next: Next) => {
    const userRoles = ctx.state.user?.roles || [];

    // 检查用户是否有允许的角色
    const hasPermission = allowedRoles.some(role => userRoles.includes(role));

    if (!hasPermission) {
      throw new ForbiddenError('权限不足');
    }

    await next();
  };
};

/**
 * 管理员权限中间件（快捷方式）
 */
export const adminMiddleware = roleMiddleware(['ADMIN']);
