import crypto from 'crypto';
import prisma from '../config/database';
import redis from '../config/redis';
import { PasswordUtil } from '../utils/password.util';
import { JwtUtil } from '../utils/jwt.util';
import { EmailService } from './email.service';
import {
  UnauthorizedError,
  ConflictError,
  ValidationError,
  ForbiddenError,
  NotFoundError
} from '../errors/custom-errors';

const emailService = new EmailService();

export interface RegisterDTO {
  email: string;
  password: string;
  username: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export class AuthService {
  async register(data: RegisterDTO, baseUrl?: string) {
    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new ConflictError('该邮箱已被注册', 'EMAIL_ALREADY_EXISTS');
    }

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username }
    });

    if (existingUsername) {
      throw new ConflictError('该用户名已被占用', 'USERNAME_ALREADY_EXISTS');
    }

    // Hash密码
    const passwordHash = await PasswordUtil.hash(data.password);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        emailVerified: false
      }
    });

    // 生成邮箱验证token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时
      }
    });

    // 发送验证邮件
    await emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      baseUrl
    );

    return {
      userId: user.id,
      email: user.email
    };
  }

  async verifyEmail(token: string) {
    const verification = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!verification) {
      throw new ValidationError('验证链接无效', { token: '验证链接无效' });
    }

    if (verification.used) {
      throw new ValidationError('验证链接已被使用', { token: '验证链接已被使用' });
    }

    if (verification.expiresAt < new Date()) {
      throw new ValidationError('验证链接已过期', { token: '验证链接已过期' });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verification.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      }),
      prisma.emailVerificationToken.update({
        where: { id: verification.id },
        data: { used: true }
      })
    ]);

    return {
      userId: verification.userId,
      email: verification.user.email
    };
  }

  async login(data: LoginDTO, ipAddress: string, userAgent: string) {
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('账号或密码错误', 'INVALID_CREDENTIALS');
    }

    // 检查账户是否锁定
    if (user.accountLocked && user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenError(
        `账号已被锁定，请在 ${minutesLeft} 分钟后再试。`,
        'ACCOUNT_LOCKED',
        { minutesLeft }
      );
    }

    // 验证密码
    const isValidPassword = await PasswordUtil.verify(
      user.passwordHash,
      data.password
    );

    if (!isValidPassword) {
      // 记录失败尝试
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedError('账号或密码错误', 'INVALID_CREDENTIALS');
    }

    // 检查邮箱是否验证
    if (!user.emailVerified) {
      throw new ForbiddenError('请先完成邮箱验证后再登录', 'EMAIL_NOT_VERIFIED');
    }

    // 创建会话
    const session = await this.createSession(
      user.id,
      ipAddress,
      userAgent,
      data.rememberMe
    );

    // 重置失败登录计数
    await this.handleSuccessfulLogin(user.id);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio,
        emailVerified: user.emailVerified
      }
    };
  }

  async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
    rememberMe: boolean = false
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('用户不存在');

    // 生成tokens
    const refreshToken = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    const accessToken = JwtUtil.generateAccessToken({
      sub: userId,
      email: user.email,
      roles: [user.role],
      sessionId
    });

    // 存储session到数据库
    const expiresAt = new Date(
      Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000
    );

    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt
      }
    });

    // 存储到Redis(快速查询)
    await redis.setex(
      `session:${sessionId}`,
      (rememberMe ? 30 : 7) * 24 * 60 * 60,
      JSON.stringify({ userId, refreshToken })
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15分钟
    };
  }

  // 仅在此处检查是否有token重用攻击，其余业务接口仅检查accesstoken有效性
  async refreshToken(oldRefreshToken: string) {
    // 查找session
    const session = await prisma.session.findUnique({
      where: { refreshToken: oldRefreshToken },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedError('刷新令牌无效或已过期', 'INVALID_REFRESH_TOKEN');
    }

    // 检查是否在黑名单中(已使用过)
    const isBlacklisted = await redis.get(`blacklist:${oldRefreshToken}`);
    if (isBlacklisted) {
      // Token重用攻击!撤销该用户所有session
      await this.revokeAllUserSessions(session.userId);
      throw new ForbiddenError('检测到刷新令牌复用风险，已撤销所有会话', 'TOKEN_REUSE_DETECTED');
    }

    // 生成新tokens
    const newRefreshToken = crypto.randomUUID();
    const newAccessToken = JwtUtil.generateAccessToken({
      sub: session.userId,
      email: session.user.email,
      roles: [session.user.role],
      sessionId: session.id
    });

    // 将旧token加入黑名单
    const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    await redis.setex(`blacklist:${oldRefreshToken}`, ttl, '1');

    // 更新session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        lastActivity: new Date()
      }
    });

    // 更新Redis
    await redis.setex(
      `session:${session.id}`,
      ttl,
      JSON.stringify({ userId: session.userId, refreshToken: newRefreshToken })
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      refreshTokenMaxAgeMs: ttl * 1000
    };
  }

  async logout(sessionId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return;

    // 删除session
    await prisma.session.delete({ where: { id: sessionId } });
    await redis.del(`session:${sessionId}`);

    // 将refresh token加入黑名单
    const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await redis.setex(`blacklist:${session.refreshToken}`, ttl, '1');
    }
  }

  async revokeAllUserSessions(userId: string) {
    const sessions = await prisma.session.findMany({ where: { userId } });

    for (const session of sessions) {
      await redis.del(`session:${session.id}`);

      const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await redis.setex(`blacklist:${session.refreshToken}`, ttl, '1');
      }
    }

    await prisma.session.deleteMany({ where: { userId } });
  }

  /**
   * 忘记密码：生成并发送重置链接（安全：不存在的邮箱也返回成功）
   * - 删除该用户旧的重置 token
   * - 生成 32 字节随机 token（1 小时过期）
   * - 发送包含 token 的重置邮件
   */
  async forgotPassword(email: string, baseUrl?: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    // 安全考虑：不透露用户是否存在
    if (!user) return;

    // 删除该用户旧的重置 token（不区分 used/expired）
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });

    // 生成新 token（32字节随机）
    const token = crypto.randomBytes(32).toString('hex');

    // 存储 token（1 小时过期）
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    // 发送重置邮件（失败会抛出 EMAIL_SEND_FAILED -> 500）
    await emailService.sendPasswordResetEmail(user.email, token, baseUrl);
  }

  /**
   * 重置密码：验证 token 后修改密码并撤销所有会话
   * 错误码：
   * - INVALID_TOKEN
   * - TOKEN_ALREADY_USED
   * - TOKEN_EXPIRED
   */
  async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!record) {
      throw new UnauthorizedError('重置链接无效', 'INVALID_TOKEN');
    }

    if (record.used) {
      throw new UnauthorizedError('重置链接已被使用', 'TOKEN_ALREADY_USED');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedError('重置链接已过期', 'TOKEN_EXPIRED');
    }

    // 提前 hash，减少事务占用时间
    const passwordHash = await PasswordUtil.hash(newPassword);

    // 事务：更新密码、重置失败计数、标记 token.used、删除 DB session
    const sessionIds = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          accountLocked: false,
          lockedUntil: null
        }
      });

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true }
      });

      const sessions = await tx.session.findMany({
        where: { userId: record.userId },
        select: { id: true }
      });

      await tx.session.deleteMany({ where: { userId: record.userId } });

      return sessions.map((s) => s.id);
    });

    // 撤销 Redis session（access token 会立即失效）
    if (sessionIds.length > 0) {
      const keys = sessionIds.map((id) => `session:${id}`);
      await redis.del(...keys);
    }

    // 发送"密码已重置"通知邮件（不影响主流程）
    try {
      await emailService.sendPasswordResetNotificationEmail(record.user.email);
    } catch {
      // best-effort：不阻断已完成的密码重置
    }
  }

  /**
   * 重新发送验证邮件
   * 
   * 安全设计说明：
   * 1. 用户不存在 -> 静默返回成功（不透露用户是否存在）
   * 2. 邮箱已验证 -> 静默返回成功（不透露验证状态）
   * 3. 邮箱未验证 -> 删除旧token，生成新token，发送邮件
   * 
   * @param email 用户邮箱
   * @param baseUrl 前端基础URL（可选）
   * @throws InternalError 邮件发送失败时抛出
   */
  async resendVerificationEmail(email: string, baseUrl?: string) {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // 安全考虑：用户不存在也返回成功（不透露用户是否存在）
    if (!user) {
      return;
    }

    // 安全考虑：已验证的用户也返回成功（不透露验证状态）
    if (user.emailVerified) {
      return;
    }

    // 删除该用户所有未使用的验证 token
    await prisma.emailVerificationToken.deleteMany({
      where: {
        userId: user.id,
        used: false
      }
    });

    // 生成新的验证 token（32字节随机）
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // 存储新 token（24小时过期，与注册流程一致）
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    // 发送验证邮件（失败会抛出 InternalError）
    await emailService.sendVerificationEmail(user.email, verificationToken, baseUrl);
  }

  private async handleFailedLogin(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const attempts = user.failedLoginAttempts + 1;
    let lockDuration = 0;

    if (attempts >= 5 && attempts < 10) {
      lockDuration = 15 * 60; // 15分钟
    } else if (attempts >= 10) {
      lockDuration = 60 * 60; // 1小时
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        accountLocked: lockDuration > 0,
        lockedUntil: lockDuration > 0
          ? new Date(Date.now() + lockDuration * 1000)
          : null
      }
    });
  }

  private async handleSuccessfulLogin(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        accountLocked: false,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    });
  }
}
