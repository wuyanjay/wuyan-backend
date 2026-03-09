import { Context } from 'koa';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { PasswordUtil } from '../utils/password.util';
import { UnauthorizedError, ValidationError } from '../errors/custom-errors';
import prisma from '../config/database';

const authService = new AuthService();

// 验证schemas
const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少为 8 位'),
  username: z.string()
    .min(3, '用户名长度至少为 3 位')
    .max(20, '用户名长度最多为 20 位')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: '请阅读并同意条款' })
  })
});

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
  rememberMe: z.boolean().optional()
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, '缺少 token')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('邮箱格式不正确')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, '缺少 token'),
  password: z.string().optional(),
  newPassword: z.string().optional()
}).refine((data) => !!(data.password || data.newPassword), {
  message: '缺少 password',
  path: ['password']
});

const resendVerificationSchema = z.object({
  email: z.string().email('邮箱格式不正确')
});

export class AuthController {
  async register(ctx: Context) {
    const body = registerSchema.parse(ctx.request.body);

    // 验证密码强度
    const passwordCheck = PasswordUtil.validateStrength(body.password);
    if (!passwordCheck.isValid) {
      throw new ValidationError('密码强度不足', {
        password: passwordCheck.errors
      });
    }

    const result = await authService.register(body);

    ctx.status = 201;
    ctx.body = {
      success: true,
      message: '注册成功，请前往邮箱完成验证后登录。',
      userId: result.userId
    };
  }

  async verifyEmail(ctx: Context) {
    const { token } = verifyEmailSchema.parse(ctx.query);

    await authService.verifyEmail(token);

    ctx.body = {
      success: true,
      message: '邮箱验证成功，现在可以登录了。'
    };
  }

  async login(ctx: Context) {
    const body = loginSchema.parse(ctx.request.body);

    const result = await authService.login(
      body,
      ctx.ip,
      ctx.headers['user-agent'] || 'unknown'
    );

    // 设置refresh token cookie
    const cookieMaxAgeMs = (body.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000;
    ctx.cookies.set('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAgeMs
    });

    ctx.body = {
      success: true,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn ?? 900,
      user: result.user
    };
  }

  async refresh(ctx: Context) {
    const refreshToken = ctx.cookies.get('refreshToken');
    if (!refreshToken) {
      throw new UnauthorizedError('未找到刷新令牌', 'NO_REFRESH_TOKEN');
    }

    const result = await authService.refreshToken(refreshToken);

    // 更新refresh token cookie
    ctx.cookies.set('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: result.refreshTokenMaxAgeMs ?? 7 * 24 * 60 * 60 * 1000
    });

    ctx.body = {
      success: true,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn ?? 900
    };
  }

  async logout(ctx: Context) {
    const sessionId = ctx.state.user?.sessionId;

    if (sessionId) {
      await authService.logout(sessionId);
    }

    // 清除cookie
    ctx.cookies.set('refreshToken', '', {
      maxAge: 0
    });

    ctx.body = {
      success: true,
      message: '退出登录成功'
    };
  }

  async me(ctx: Context) {
    const userId = ctx.state.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        nickname: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        createdAt: true
      }
    });

    ctx.body = {
      success: true,
      user
    };
  }

  /**
   * POST /api/auth/forgot-password
   * 安全：无论邮箱是否存在都返回成功（发送失败除外）
   */
  async forgotPassword(ctx: Context) {
    // HPP 防护：如果 email 是数组，取第一个
    const rawBody = ctx.request.body as any;
    if (rawBody && Array.isArray(rawBody.email)) {
      rawBody.email = rawBody.email[0];
    }
    
    const body = forgotPasswordSchema.parse(rawBody);

    await authService.forgotPassword(body.email);

    ctx.body = {
      success: true,
      message: '重置链接已发送（如果账户存在，请检查邮箱）。'
    };
  }

  /**
   * POST /api/auth/reset-password
   * body: { token, password }
   */
  async resetPassword(ctx: Context) {
    const body = resetPasswordSchema.parse(ctx.request.body);
    const password = body.password ?? body.newPassword ?? '';

    // 验证密码强度
    const passwordCheck = PasswordUtil.validateStrength(password);
    if (!passwordCheck.isValid) {
      throw new ValidationError('密码强度不足', {
        password: passwordCheck.errors
      });
    }

    await authService.resetPassword(body.token, password);

    ctx.body = {
      success: true,
      message: '密码已重置，请重新登录。'
    };
  }

  /**
   * POST /api/auth/resend-verification-email
   * 重新发送验证邮件
   * 
   * 响应说明：
   * - 无论邮箱是否存在或已验证，都返回成功（安全设计）
   * - 仅在邮件发送失败时返回 500 错误
   */
  async resendVerificationEmail(ctx: Context) {
    // HPP 防护：如果 email 是数组，取第一个
    const rawBody = ctx.request.body as any;
    if (rawBody && Array.isArray(rawBody.email)) {
      rawBody.email = rawBody.email[0];
    }

    const body = resendVerificationSchema.parse(rawBody);

    const baseUrl = ctx.get('Origin');
    await authService.resendVerificationEmail(body.email, baseUrl);

    ctx.body = {
      success: true,
      message: '验证邮件已重新发送（如果账户存在且未验证）。'
    };
  }
}
