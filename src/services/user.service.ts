import { Prisma, Role } from '@prisma/client';
import prisma from '../config/database';
import { PasswordUtil } from '../utils/password.util';
import {
  CreateUserDTO,
  UpdateUserDTO,
  UserListQuery,
  UserResponse
} from '../types/user.types';
import {
  NotFoundError,
  ConflictError
} from '../errors/custom-errors';

export class UserService {
  /**
   * 创建用户
   */
  async createUser(data: CreateUserDTO): Promise<UserResponse> {
    // 检查邮箱唯一性
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existingEmail) {
      throw new ConflictError('该邮箱已被注册');
    }

    // 检查用户名唯一性
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username }
    });
    if (existingUsername) {
      throw new ConflictError('该用户名已被占用');
    }

    // 密码加密
    const passwordHash = await PasswordUtil.hash(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        role: data.role || Role.USER,
        nickname: data.nickname,
        avatar: data.avatar,
        bio: data.bio,
        emailVerified: false // 默认未验证，或者管理员创建可以直接置为 true
      }
    });

    return this.formatUserResponse(user);
  }

  /**
   * 获取所有用户（分页、排序、过滤）
   */
  async getUsers(query: UserListQuery) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || 'createdAt';
    const order = query.order || 'desc';

    // 构建查询条件
    const where: Prisma.UserWhereInput = {};
    
    if (query.search) {
      where.OR = [
        { username: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { nickname: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    if (query.role) {
      where.role = query.role;
    }

    // 执行查询
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order }
      }),
      prisma.user.count({ where })
    ]);

    return {
      data: users.map(user => this.formatUserResponse(user)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(id: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    return this.formatUserResponse(user);
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, data: UpdateUserDTO): Promise<UserResponse> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const updateData: any = { ...data };

    // 如果更新密码，需要重新加密
    if (data.password) {
      updateData.passwordHash = await PasswordUtil.hash(data.password);
      delete updateData.password;
    }

    // 检查唯一性冲突 (如果更新了 email 或 username)
    if (data.email && data.email !== user.email) {
      const exists = await prisma.user.findUnique({ where: { email: data.email } });
      if (exists) throw new ConflictError('该邮箱已被注册');
    }
    
    if (data.username && data.username !== user.username) {
      const exists = await prisma.user.findUnique({ where: { username: data.username } });
      if (exists) throw new ConflictError('该用户名已被占用');
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    return this.formatUserResponse(updatedUser);
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    await prisma.user.delete({ where: { id } });
  }

  /**
   * 格式化返回数据（去除敏感信息）
   */
  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      nickname: user.nickname,
      avatar: user.avatar,
      bio: user.bio,
      emailVerified: user.emailVerified,
      accountLocked: user.accountLocked,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
