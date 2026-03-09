import { Context } from 'koa';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { Role } from '@prisma/client';
import { ForbiddenError } from '../errors/custom-errors';

const userService = new UserService();

// 验证 Schemas
const createUserSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  username: z.string().min(3).max(20),
  password: z.string().min(6, '密码至少6位'),
  role: z.nativeEnum(Role).optional(),
  nickname: z.string().optional(),
  avatar: z.string().url().optional(),
  bio: z.string().optional()
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(20).optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(Role).optional(),
  nickname: z.string().optional(),
  avatar: z.string().url().optional(),
  bio: z.string().optional(),
  emailVerified: z.boolean().optional(),
  accountLocked: z.boolean().optional()
});

export class UserController {
  /**
   * POST /api/users
   * 创建用户 (管理员)
   */
  async createUser(ctx: Context) {
    const body = createUserSchema.parse(ctx.request.body);
    const user = await userService.createUser(body);

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: user
    };
  }

  /**
   * GET /api/users
   * 获取所有用户 (管理员)
   */
  async getUsers(ctx: Context) {
    const query = {
      page: ctx.query.page ? parseInt(ctx.query.page as string) : 1,
      limit: ctx.query.limit ? parseInt(ctx.query.limit as string) : 10,
      sortBy: ctx.query.sortBy as string,
      order: ctx.query.order as 'asc' | 'desc',
      search: ctx.query.search as string,
      role: ctx.query.role as Role
    };

    const result = await userService.getUsers(query);

    ctx.body = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }

  /**
   * GET /api/users/:id
   * 获取单个用户
   */
  async getUserById(ctx: Context) {
    const userId = ctx.params.id;
    // 权限检查：只能查自己或管理员
    const currentUserId = ctx.state.user.id || ctx.state.user.sub;
    const currentUserRole = ctx.state.user.roles?.[0];

    if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
        // 为了安全，有时会报404或403，这里报403
        throw new ForbiddenError('无权查看该用户信息');
    }

    const user = await userService.getUserById(userId);
    ctx.body = {
      success: true,
      data: user
    };
  }

  /**
   * PATCH /api/users/:id
   * 更新用户
   */
  async updateUser(ctx: Context) {
    const userId = ctx.params.id;
    const currentUserId = ctx.state.user.id || ctx.state.user.sub;
    const currentUserRole = ctx.state.user.roles?.[0];

    // 权限检查：只能改自己或管理员
    // 注意：普通用户不能改 role, accountLocked 等敏感字段
    if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
      throw new ForbiddenError('无权修改该用户信息');
    }

    const body = updateUserSchema.parse(ctx.request.body);

    // 如果是普通用户，移除敏感字段更新权限
    if (currentUserRole !== 'ADMIN') {
      delete body.role;
      delete body.accountLocked;
      delete body.emailVerified;
    }

    const user = await userService.updateUser(userId, body);
    ctx.body = {
      success: true,
      data: user
    };
  }

  /**
   * DELETE /api/users/:id
   * 删除用户 (管理员)
   */
  async deleteUser(ctx: Context) {
    const userId = ctx.params.id;
    
    // 只有管理员能删除，且一般不能删除自己（可选逻辑）
    // Middleware 已保证是 ADMIN
    
    await userService.deleteUser(userId);
    ctx.status = 204;
  }
}
