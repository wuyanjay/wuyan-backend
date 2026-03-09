# 重新发送验证邮件功能 - 后端实现文档

## 📋 目录

1. [功能概述](#功能概述)
2. [API 接口规范](#api-接口规范)
3. [代码改动](#代码改动)
4. [速率限制策略](#速率限制策略)
5. [安全考虑](#安全考虑)
6. [测试用例](#测试用例)

---

## 功能概述

### 业务需求

用户在注册后可能因为以下原因未收到验证邮件：
- 邮件进入垃圾箱
- 邮件发送延迟
- 邮箱地址输入错误
- 邮件服务器临时故障

因此需要提供"重新发送验证邮件"功能，允许用户主动触发邮件重发。

### 核心特性

✅ **安全设计**：不透露用户是否存在或验证状态  
✅ **防止滥用**：严格的速率限制（3次/小时）  
✅ **数据清理**：删除旧 token，避免堆积  
✅ **幂等性**：多次调用返回一致结果  
✅ **错误处理**：完善的异常处理机制  

---

## API 接口规范

### 接口信息

- **URL**: `/api/auth/resend-verification-email`
- **Method**: `POST`
- **认证**: 不需要（公开接口）
- **速率限制**: 3次/小时/IP + 3次/小时/邮箱

### 请求体

```typescript
interface ResendVerificationRequest {
  email: string;  // 必填，邮箱地址
}
```

**示例**:
```json
{
  "email": "user@example.com"
}
```

### 响应

#### 成功 (200 OK)

无论邮箱是否存在、是否已验证，都返回统一成功响应（安全设计）

```json
{
  "success": true,
  "message": "验证邮件已重新发送（如果账户存在且未验证）。"
}
```

#### 验证失败 (400 Bad Request)

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "邮箱格式不正确",
  "details": {
    "email": "邮箱格式不正确"
  }
}
```

#### 速率限制 (429 Too Many Requests)

```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "请求过于频繁，请稍后再试",
  "retryAfter": 3600
}
```

#### 邮件发送失败 (500 Internal Server Error)

```json
{
  "success": false,
  "error": "EMAIL_SEND_FAILED",
  "message": "邮件发送失败，请稍后重试",
  "details": {
    "type": "verification",
    "to": "user@example.com"
  }
}
```

---

## 代码改动

### 1. AuthService 新增方法

**文件**: `src/services/auth.service.ts`

在 `AuthService` 类中添加以下方法：

```typescript
/**
 * 重新发送验证邮件
 * 
 * 安全设计说明：
 * 1. 用户不存在 -> 静默返回成功（不透露用户是否存在）
 * 2. 邮箱已验证 -> 静默返回成功（不透露验证状态）
 * 3. 邮箱未验证 -> 删除旧token，生成新token，发送邮件
 * 
 * @param email 用户邮箱
 * @throws InternalError 邮件发送失败时抛出
 */
async resendVerificationEmail(email: string): Promise<void> {
  // 1. 查找用户
  const user = await prisma.user.findUnique({
    where: { email }
  });

  // 2. 安全考虑：用户不存在也返回成功（不透露用户是否存在）
  if (!user) {
    // 可选：记录审计日志
    // await this.logResendAttempt(email, 'user_not_found');
    return;
  }

  // 3. 安全考虑：已验证的用户也返回成功（不透露验证状态）
  if (user.emailVerified) {
    // 可选：记录审计日志
    // await this.logResendAttempt(email, 'already_verified');
    return;
  }

  // 4. 删除该用户所有未使用的验证 token
  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId: user.id,
      used: false
    }
  });

  // 5. 生成新的验证 token（32字节随机）
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  // 6. 存储新 token（24小时过期，与注册流程一致）
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  // 7. 发送验证邮件（失败会抛出 InternalError）
  await emailService.sendVerificationEmail(user.email, verificationToken);

  // 可选：记录成功的审计日志
  // await this.logResendAttempt(email, 'success', user.id);
}
```

**完整文件位置**：在 `AuthService` 类的 `resetPassword()` 方法之后添加

---

### 2. AuthController 新增方法

**文件**: `src/controllers/auth.controller.ts`

#### 2.1 添加验证 Schema

在文件顶部的 schema 定义区域添加：

```typescript
const resendVerificationSchema = z.object({
  email: z.string().email('邮箱格式不正确')
});
```

**位置**：在 `resetPasswordSchema` 之后

#### 2.2 添加 Controller 方法

在 `AuthController` 类中添加以下方法：

```typescript
/**
 * POST /api/auth/resend-verification-email
 * 重新发送验证邮件
 * 
 * 响应说明：
 * - 无论邮箱是否存在或已验证，都返回成功（安全设计）
 * - 仅在邮件发送失败时返回 500 错误
 */
async resendVerificationEmail(ctx: Context) {
  // 1. 验证请求体
  const body = resendVerificationSchema.parse(ctx.request.body);

  // 2. 调用 Service 处理业务逻辑
  await authService.resendVerificationEmail(body.email);

  // 3. 返回统一成功响应
  ctx.body = {
    success: true,
    message: '验证邮件已重新发送（如果账户存在且未验证）。'
  };
}
```

**位置**：在 `resetPassword()` 方法之后

---

### 3. 路由配置

**文件**: `src/routes/auth.routes.ts`

#### 3.1 添加速率限制器

在路由定义之前添加速率限制器配置：

```typescript
/**
 * 重新发送验证邮件限流器
 * - 3次请求/小时/IP
 * - 防止邮件轰炸和滥用
 */
const resendVerificationRateLimiter = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000,    // 1小时
  maxRequests: 3,
  keyGenerator: (ctx) => `resend-verification:${ctx.ip}`
});
```

**位置**：在 `forgotPasswordRateLimiter` 之后

#### 3.2 添加路由

在路由定义区域添加：

```typescript
// 重新发送验证邮件
router.post(
  '/resend-verification-email',
  resendVerificationRateLimiter,
  (ctx) => authController.resendVerificationEmail(ctx)
);
```

**位置**：建议在 `/verify-email` 路由之后

#### 完整路由配置示例

```typescript
// 注册与验证相关
router.post('/register', registerRateLimiter, (ctx) => authController.register(ctx));
router.get('/verify-email', (ctx) => authController.verifyEmail(ctx));
router.post('/resend-verification-email', resendVerificationRateLimiter, (ctx) => authController.resendVerificationEmail(ctx));

// 登录相关
router.post('/login', loginRateLimiter, (ctx) => authController.login(ctx));
router.post('/refresh', (ctx) => authController.refresh(ctx));
router.post('/logout', authMiddleware, (ctx) => authController.logout(ctx));
router.get('/me', authMiddleware, (ctx) => authController.me(ctx));

// 密码重置相关
router.post('/forgot-password', forgotPasswordRateLimiter, (ctx) => authController.forgotPassword(ctx));
router.post('/reset-password', resetPasswordRateLimiter, (ctx) => authController.resetPassword(ctx));
```

---

## 速率限制策略

### 基于 IP 的限流（当前实现）

```typescript
const resendVerificationRateLimiter = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000,    // 1小时窗口
  maxRequests: 3,               // 最多3次请求
  keyGenerator: (ctx) => `resend-verification:${ctx.ip}`
});
```

**优点**：实现简单，防止单个 IP 滥用  
**缺点**：无法防止攻击者使用不同 IP 对同一邮箱发起攻击

---

### 增强版：IP + 邮箱双重限流（推荐）

如果需要更强的保护，可以实现基于邮箱的额外限流：

**文件**: `src/middlewares/ratelimit.middleware.ts`

```typescript
/**
 * 邮箱级别的速率限制中间件
 * 
 * 适用场景：
 * - 防止对同一邮箱的重复请求（即使来自不同 IP）
 * - 适用于注册、重新发送验证邮件、忘记密码等接口
 * 
 * @param config 配置项
 * @returns Koa 中间件
 */
export const emailRateLimitMiddleware = (config: {
  windowMs: number;
  maxRequests: number;
}) => {
  return async (ctx: Context, next: Next) => {
    const email = ctx.request.body?.email;
    
    // 如果请求体中没有 email 字段，跳过限流
    if (!email) {
      await next();
      return;
    }

    const window = Math.floor(Date.now() / config.windowMs);
    
    // 同时检查 IP 和邮箱的请求次数
    const ipKey = `ratelimit:ip:${ctx.ip}:${window}`;
    const emailKey = `ratelimit:email:${email}:${window}`;

    const [ipCount, emailCount] = await Promise.all([
      redis.incr(ipKey),
      redis.incr(emailKey)
    ]);

    // 设置过期时间
    if (ipCount === 1) {
      await redis.expire(ipKey, Math.ceil(config.windowMs / 1000));
    }
    if (emailCount === 1) {
      await redis.expire(emailKey, Math.ceil(config.windowMs / 1000));
    }

    // 任一限制超过阈值即拒绝请求
    if (ipCount > config.maxRequests || emailCount > config.maxRequests) {
      ctx.status = 429;
      ctx.body = {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil(config.windowMs / 1000)
      };
      return;
    }

    ctx.set('X-RateLimit-Remaining-IP', (config.maxRequests - ipCount).toString());
    ctx.set('X-RateLimit-Remaining-Email', (config.maxRequests - emailCount).toString());
    
    await next();
  };
};
```

**使用方式**：

```typescript
// src/routes/auth.routes.ts

import { emailRateLimitMiddleware } from '../middlewares/ratelimit.middleware';

const resendVerificationRateLimiter = emailRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3
});
```

---

## 安全考虑

### 1. 不透露用户信息

**问题**：如果对不存在的邮箱返回错误，攻击者可以枚举系统中的用户邮箱

**解决方案**：

```typescript
// ❌ 不安全的实现
if (!user) {
  throw new NotFoundError('该邮箱未注册');
}

// ✅ 安全的实现
if (!user) {
  return; // 静默返回，不抛出错误
}
```

所有情况都返回相同的成功响应：

```json
{
  "success": true,
  "message": "验证邮件已重新发送（如果账户存在且未验证）。"
}
```

---

### 2. 防止时序攻击

**问题**：攻击者可能通过响应时间差异判断用户是否存在

**解决方案**（可选）：

```typescript
async resendVerificationEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // 模拟相同的处理时间
    await this.simulateEmailSend();
    return;
  }
  
  // 正常流程...
}

/**
 * 模拟邮件发送的耗时，防止时序攻击
 */
private async simulateEmailSend(): Promise<void> {
  crypto.randomBytes(32).toString('hex');
  await new Promise(resolve => setTimeout(resolve, 100)); // 模拟延迟
}
```

---

### 3. 清理旧 Token

**问题**：频繁重发会导致数据库中 token 堆积

**解决方案**：

```typescript
// 删除该用户所有未使用的验证 token
await prisma.emailVerificationToken.deleteMany({
  where: {
    userId: user.id,
    used: false  // 只删除未使用的
  }
});
```

**进阶**：定期清理所有过期 token

```typescript
// src/services/cleanup.service.ts

export class CleanupService {
  /**
   * 清理所有过期的验证 token
   * 建议：每天凌晨执行一次（通过 cron job）
   */
  async cleanupExpiredVerificationTokens(): Promise<number> {
    const result = await prisma.emailVerificationToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    
    return result.count;
  }
}
```

---

### 4. 审计日志（可选但推荐）

记录所有重发请求，便于安全分析和异常检测：

```typescript
/**
 * 记录重新发送验证邮件的审计日志
 */
private async logResendAttempt(
  email: string, 
  result: 'success' | 'user_not_found' | 'already_verified',
  userId?: string
): Promise<void> {
  // 实现方式1：存储到数据库
  await prisma.auditLog.create({
    data: {
      eventType: 'resend_verification_email',
      userId,
      metadata: {
        email,
        result,
        timestamp: new Date()
      }
    }
  });
  
  // 实现方式2：发送到日志服务
  logger.info('Resend verification email attempt', {
    email,
    result,
    userId
  });
}
```

在 `resendVerificationEmail` 方法中调用：

```typescript
async resendVerificationEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await this.logResendAttempt(email, 'user_not_found');
    return;
  }

  if (user.emailVerified) {
    await this.logResendAttempt(email, 'already_verified', user.id);
    return;
  }

  // ... 删除旧 token，生成新 token ...
  
  await emailService.sendVerificationEmail(user.email, verificationToken);
  await this.logResendAttempt(email, 'success', user.id);
}
```

---

## 测试用例

### 1. 单元测试

**文件**: `tests/unit/auth.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '@/services/auth.service';
import { EmailService } from '@/services/email.service';
import prisma from '@/config/database';

describe('AuthService - resendVerificationEmail', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  afterEach(async () => {
    // 清理测试数据
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('成功场景', () => {
    it('应该为未验证用户重新发送验证邮件', async () => {
      // 1. 创建测试用户
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          emailVerified: false
        }
      });

      // 2. 创建旧的验证 token
      const oldToken = await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          token: 'old-token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      // 3. Mock 邮件服务
      const emailSpy = vi.spyOn(EmailService.prototype, 'sendVerificationEmail')
        .mockResolvedValue();

      // 4. 调用重发方法
      await authService.resendVerificationEmail('test@example.com');

      // 5. 验证旧 token 已被删除
      const oldTokenExists = await prisma.emailVerificationToken.findUnique({
        where: { id: oldToken.id }
      });
      expect(oldTokenExists).toBeNull();

      // 6. 验证新 token 已创建
      const newTokens = await prisma.emailVerificationToken.findMany({
        where: { userId: user.id }
      });
      expect(newTokens).toHaveLength(1);
      expect(newTokens[0].token).not.toBe('old-token');

      // 7. 验证邮件已发送
      expect(emailSpy).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String)
      );
    });

    it('应该在用户不存在时静默返回（不抛出错误）', async () => {
      await expect(
        authService.resendVerificationEmail('nonexistent@example.com')
      ).resolves.not.toThrow();
    });

    it('应该在用户已验证时静默返回（不发送邮件）', async () => {
      // 1. 创建已验证用户
      await prisma.user.create({
        data: {
          email: 'verified@example.com',
          username: 'verified',
          passwordHash: 'hash',
          emailVerified: true
        }
      });

      // 2. Mock 邮件服务
      const emailSpy = vi.spyOn(EmailService.prototype, 'sendVerificationEmail');

      // 3. 调用重发方法
      await authService.resendVerificationEmail('verified@example.com');

      // 4. 验证邮件未发送
      expect(emailSpy).not.toHaveBeenCalled();
    });
  });

  describe('Token 管理', () => {
    it('应该删除所有未使用的旧 token', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          emailVerified: false
        }
      });

      // 创建多个旧 token
      await prisma.emailVerificationToken.createMany({
        data: [
          {
            userId: user.id,
            token: 'token-1',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            used: false
          },
          {
            userId: user.id,
            token: 'token-2',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            used: false
          }
        ]
      });

      vi.spyOn(EmailService.prototype, 'sendVerificationEmail')
        .mockResolvedValue();

      await authService.resendVerificationEmail('test@example.com');

      // 验证只剩一个新 token
      const tokens = await prisma.emailVerificationToken.findMany({
        where: { userId: user.id }
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].token).not.toBe('token-1');
      expect(tokens[0].token).not.toBe('token-2');
    });

    it('应该保留已使用的 token（不删除）', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          emailVerified: false
        }
      });

      // 创建已使用的 token
      const usedToken = await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          token: 'used-token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          used: true
        }
      });

      vi.spyOn(EmailService.prototype, 'sendVerificationEmail')
        .mockResolvedValue();

      await authService.resendVerificationEmail('test@example.com');

      // 验证已使用的 token 仍然存在
      const stillExists = await prisma.emailVerificationToken.findUnique({
        where: { id: usedToken.id }
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe('错误处理', () => {
    it('应该在邮件发送失败时抛出错误', async () => {
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          emailVerified: false
        }
      });

      vi.spyOn(EmailService.prototype, 'sendVerificationEmail')
        .mockRejectedValue(new Error('SMTP error'));

      await expect(
        authService.resendVerificationEmail('test@example.com')
      ).rejects.toThrow();
    });
  });
});
```

---

### 2. 集成测试

**文件**: `tests/integration/resend-verification.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '@/app';
import prisma from '@/config/database';
import redis from '@/config/redis';

describe('POST /api/auth/resend-verification-email', () => {
  beforeEach(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    await redis.flushdb(); // 清空 Redis
  });

  afterEach(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    await redis.flushdb();
  });

  describe('成功场景', () => {
    it('应该为未验证用户返回成功', async () => {
      // 创建未验证用户
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          emailVerified: false
        }
      });

      const res = await request(app)
        .post('/api/auth/resend-verification-email')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        message: expect.stringContaining('验证邮件已重新发送')
      });
    });

    it('应该为不存在的邮箱返回成功（安全设计）', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification-email')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('应该为已验证用户返回成功（安全设计）', async () => {
      await prisma.user.create({
        data: {
          email: 'verified@example.com',
          username: 'verified',
          passwordHash: 'hash',
          emailVerified: true
        }
      });

      const res = await request(app)
        .post('/api/auth/resend-verification-email')
        .send({ email: 'verified@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('验证失败', () => {
    it('应该拒绝无效的邮箱格式', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification-email')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('应该拒绝缺少邮箱的请求', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification-email')
        .send({})
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('速率限制', () => {
    it('应该在超过限制后返回 429', async () => {
      const email = 'test@example.com';

      // 创建用户
      await prisma.user.create({
        data: {
          email,
          username: 'testuser',
          passwordHash: 'hash',
          emailVerified: false
        }
      });

      // 发送 4 次请求（限制是 3 次）
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/auth/resend-verification-email')
          .send({ email });

        if (i < 3) {
          expect(res.status).toBe(200);
        } else {
          expect(res.status).toBe(429);
          expect(res.body.error).toBe('RATE_LIMIT_EXCEEDED');
        }
      }
    });
  });

  describe('Token 管理', () => {
    it('应该删除旧 token 并创建新 token', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          emailVerified: false
        }
      });

      // 创建旧 token
      const oldToken = await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          token: 'old-token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      await request(app)
        .post('/api/auth/resend-verification-email')
        .send({ email: 'test@example.com' })
        .expect(200);

      // 验证旧 token 已删除
      const oldTokenExists = await prisma.emailVerificationToken.findUnique({
        where: { id: oldToken.id }
      });
      expect(oldTokenExists).toBeNull();

      // 验证新 token 已创建
      const newTokens = await prisma.emailVerificationToken.findMany({
        where: { userId: user.id }
      });
      expect(newTokens).toHaveLength(1);
      expect(newTokens[0].token).not.toBe('old-token');
    });
  });
});
```

---

### 3. E2E 测试

**文件**: `tests/e2e/resend-verification.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('重新发送验证邮件', () => {
  test('用户可以重新发送验证邮件', async ({ page }) => {
    // 1. 访问登录页面
    await page.goto('/login');
    
    // 2. 点击"没有收到验证邮件"链接
    await page.click('text=重新发送验证邮件');
    
    // 3. 验证跳转到重发页面
    await expect(page).toHaveURL(/\/verify-email/);
    
    // 4. 输入邮箱
    await page.fill('input[type="email"]', 'test@example.com');
    
    // 5. 点击发送按钮
    await page.click('button:has-text("重新发送")');
    
    // 6. 验证成功提示
    await expect(page.locator('text=验证邮件已重新发送')).toBeVisible();
    
    // 7. 验证按钮进入冷却状态
    const button = page.locator('button:has-text("重新发送")');
    await expect(button).toBeDisabled();
    await expect(button).toContainText(/\d+s/); // 显示倒计时
  });

  test('速率限制生效', async ({ page }) => {
    await page.goto('/verify-email?email=test@example.com');
    
    // 连续点击 4 次
    for (let i = 0; i < 4; i++) {
      await page.click('button:has-text("重新发送")');
      await page.waitForTimeout(1000);
      
      if (i < 3) {
        await expect(page.locator('text=验证邮件已重新发送')).toBeVisible();
      } else {
        await expect(page.locator('text=请求过于频繁')).toBeVisible();
      }
    }
  });
});
```

---

## 部署注意事项

### 1. 环境变量

确保以下环境变量已配置：

```bash
# SMTP 邮件服务配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=Auth System

# 前端 URL（用于生成验证链接）
FRONTEND_URL=https://your-app.com

# Redis 配置（用于速率限制）
REDIS_URL=redis://localhost:6379
```

---

### 2. 数据库迁移

无需新建表，使用现有的 `email_verification_tokens` 表。

如需添加审计日志功能，执行以下迁移：

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

### 3. 监控指标

建议监控以下指标：

```typescript
// 使用 Prometheus 或其他监控工具

// 1. 重发请求总数
const resendRequestsTotal = new Counter({
  name: 'resend_verification_requests_total',
  help: 'Total resend verification email requests',
  labelNames: ['result'] // 'success', 'user_not_found', 'already_verified'
});

// 2. 速率限制触发次数
const rateLimitHits = new Counter({
  name: 'resend_verification_rate_limit_hits_total',
  help: 'Total rate limit hits for resend verification'
});

// 3. 邮件发送失败次数
const emailFailures = new Counter({
  name: 'verification_email_send_failures_total',
  help: 'Total verification email send failures'
});
```

---

## 常见问题 (FAQ)

### Q1: 为什么用户已验证还返回成功？

**A**: 这是安全设计。如果返回"该邮箱已验证"，攻击者可以枚举系统中的用户并知道他们的验证状态。统一返回成功可以防止信息泄露。

---

### Q2: 速率限制 3次/小时会不会太严格？

**A**: 这是合理的限制：
- 正常用户不会频繁重发（邮件延迟通常在几分钟内）
- 防止邮件轰炸攻击
- 如果用户确实需要，1小时后可以再次尝试

如果业务需要，可以调整为 `5次/小时`。

---

### Q3: 是否需要通知用户重发成功？

**A**: 不建议发送"重发成功"的邮件，因为：
- 会造成邮件堆积（用户可能多次点击）
- 验证邮件本身就包含了所有必要信息
- 增加邮件服务器负担

---

### Q4: 旧 token 是否应该立即失效？

**A**: 是的，当前实现会删除所有未使用的旧 token，原因：
- 避免多个有效 token 同时存在（安全隐患）
- 保持数据库清洁
- 用户只需要最新的 token

---

### Q5: 如何处理邮件发送失败？

**A**: 当前实现会抛出 500 错误。可以考虑以下改进：
- 使用消息队列重试（如 Bull、Redis Queue）
- 记录失败日志供人工处理
- 提供备用验证方式（如短信验证）

---

## 总结

### 完整改动清单

| 文件 | 改动类型 | 具体内容 |
|------|---------|---------|
| `src/services/auth.service.ts` | 新增方法 | `resendVerificationEmail()` |
| `src/controllers/auth.controller.ts` | 新增 | Schema + Controller 方法 |
| `src/routes/auth.routes.ts` | 新增 | 路由 + 速率限制器 |
| `src/middlewares/ratelimit.middleware.ts` | 可选新增 | `emailRateLimitMiddleware()` |

### 核心特性

✅ 安全设计：不透露用户存在性和验证状态  
✅ 防滥用：严格的速率限制（3次/小时）  
✅ 数据清理：自动删除旧 token  
✅ 错误处理：完善的异常处理机制  
✅ 可测试性：完整的单元/集成/E2E 测试  

### 下一步

1. 实现前端界面（参考前端文档）
2. 配置邮件服务（SMTP）
3. 编写并运行测试用例
4. 部署到生产环境
5. 监控邮件发送成功率和速率限制触发率

---

**文档版本**: 1.0  
**最后更新**: 2026-01-22  
**作者**: Backend Team
