import { logger } from '../utils/logger';
import { env } from '../config/env';
import nodemailer from 'nodemailer';
import { InternalError } from '../errors/custom-errors';

export class EmailService {
  private fromEmail: string;
  private fromName: string;
  private frontendUrl: string;
  private transporter: nodemailer.Transporter;

  constructor() {
    // 使用SMTP配置
    this.fromEmail = env.SMTP_FROM_EMAIL;
    this.fromName = env.SMTP_FROM_NAME;
    this.frontendUrl = env.FRONTEND_URL;

    // 创建SMTP传输器
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465端口使用SSL，587端口使用TLS
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  }

  /**
   * 发送邮箱验证邮件
   * @param to 收件人邮箱
   * @param token 验证令牌
   * @param baseUrl 前端基础URL（可选）
   * @returns Promise<void>
   */
  async sendVerificationEmail(to: string, token: string, baseUrl?: string): Promise<void> {
    try {
      const url = baseUrl || this.frontendUrl;
      const verificationUrl = `${url}/verify-email?token=${token}`;

      // 邮件内容（支持黑暗模式）
      const mailOptions = {
        from: { name: this.fromName, address: this.fromEmail },
        to,
        subject: '验证您的邮箱地址',
        html: `
          <style>
            @media (prefers-color-scheme: dark) {
              .email-container {
                background-color: #1a1a1a !important;
                border-color: #333 !important;
              }
              .email-title {
                color: #e0e0e0 !important;
              }
              .email-text {
                color: #b0b0b0 !important;
              }
              .email-url-box {
                background-color: #2a2a2a !important;
              }
              .email-url-text {
                color: #e0e0e0 !important;
              }
            }
          </style>
          <div class="email-container" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h1 class="email-title" style="color: #333;">欢迎使用 Auth System</h1>
            <p class="email-text">请点击下方链接验证您的邮箱地址：</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" style="background-color: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                验证邮箱
              </a>
            </p>
            <p class="email-text">或者复制以下链接到浏览器中打开：</p>
            <p class="email-url-box" style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; word-break: break-all;">
              <span class="email-url-text" style="color: #333;">${verificationUrl}</span>
            </p>
            <p class="email-text"><strong>注意：</strong>该验证链接将在24小时后过期，请及时验证。</p>
            <p class="email-text">如果您没有请求此验证邮件，请忽略此邮件。</p>
            <p class="email-text">此致<br/>Auth System 团队</p>
          </div>
        `
      };

      // 开发环境下检查SMTP配置
      if (process.env.NODE_ENV === 'development') {
        if (!env.SMTP_PASS) {
          logger.info('📧 [DEV] Verification email would be sent (SMTP_PASS not configured):', {
            to,
            verificationUrl
          });
          return;
        }
      }
      logger.info('📧 Sending verification email from:', mailOptions.from.address, env.SMTP_PASS);

      // 发送邮件
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('📧 Verification email sent successfully:', {
        to,
        messageId: info.messageId
      });
    } catch (error) {
      logger.error('❌ Failed to send verification email:', {
        to,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new InternalError('邮件发送失败，请稍后重试', 'EMAIL_SEND_FAILED', {
        type: 'verification',
        to
      });
    }
  }

  /**
   * 发送密码重置邮件
   * @param to 收件人邮箱
   * @param token 重置令牌
   * @param baseUrl 前端基础URL（可选，默认使用环境变量）
   * @returns Promise<void>
   */
  async sendPasswordResetEmail(to: string, token: string, baseUrl?: string): Promise<void> {
    try {
      const url = baseUrl || this.frontendUrl;
      const resetUrl = `${url}/reset-password?token=${token}`;

      // 邮件内容
      const mailOptions = {
        from: { name: this.fromName, address: this.fromEmail },
        to,
        subject: '重置您的密码',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h1 style="color: #333;">密码重置请求</h1>
            <p>我们收到了您的密码重置请求，请点击下方链接重置您的密码：</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" style="background-color: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                重置密码
              </a>
            </p>
            <p>或者复制以下链接到浏览器中打开：</p>
            <p style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; word-break: break-all;">
              ${resetUrl}
            </p>
            <p><strong>注意：</strong>该重置链接将在 1 小时后过期，请及时重置密码。</p>
            <p>如果您没有请求此密码重置，请忽略此邮件。</p>
            <p>此致<br/>Auth System 团队</p>
          </div>
        `
      };

      // 开发环境下检查SMTP配置
      if (process.env.NODE_ENV === 'development') {
        if (!env.SMTP_PASS) {
          logger.info('📧 [DEV] Password reset email would be sent (SMTP_PASS not configured):', {
            to,
            resetUrl
          });
          return;
        }
      }

      // 发送邮件
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('📧 Password reset email sent successfully:', {
        to,
        messageId: info.messageId
      });
    } catch (error) {
      logger.error('❌ Failed to send password reset email:', {
        to,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new InternalError('邮件发送失败，请稍后重试', 'EMAIL_SEND_FAILED', {
        type: 'password_reset',
        to
      });
    }
  }

  /**
   * 发送“密码已重置”通知邮件
   * @param to 收件人邮箱
   */
  async sendPasswordResetNotificationEmail(to: string): Promise<void> {
    try {
      const mailOptions = {
        from: { name: this.fromName, address: this.fromEmail },
        to,
        subject: '您的密码已重置',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h1 style="color: #333;">密码已重置通知</h1>
            <p>您的账号密码已成功重置。</p>
            <p>如果这不是您本人操作，请立即联系管理员，并尽快重新重置密码。</p>
            <p>此致<br/>Auth System 团队</p>
          </div>
        `
      };

      if (process.env.NODE_ENV === 'development') {
        if (!env.SMTP_PASS) {
          logger.info('📧 [DEV] Password reset notification email would be sent (SMTP_PASS not configured):', {
            to
          });
          return;
        }
      }

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('📧 Password reset notification email sent successfully:', {
        to,
        messageId: info.messageId
      });
    } catch (error) {
      logger.error('❌ Failed to send password reset notification email:', {
        to,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new InternalError('邮件发送失败，请稍后重试', 'EMAIL_SEND_FAILED', {
        type: 'password_reset_notification',
        to
      });
    }
  }

  /**
   * 发送账号锁定邮件
   * @param to 收件人邮箱
   * @param durationMinutes 锁定时长（分钟）
   * @returns Promise<void>
   */
  async sendAccountLockedEmail(to: string, durationMinutes: number): Promise<void> {
    try {
      // 邮件内容
      const mailOptions = {
        from: { name: this.fromName, address: this.fromEmail },
        to,
        subject: '您的账号已被锁定',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h1 style="color: #d93025;">账号锁定通知</h1>
            <p>由于多次登录失败，您的账号已被锁定。</p>
            <p><strong>锁定时长：</strong>${durationMinutes}分钟</p>
            <p>请在锁定时间结束后尝试重新登录，或联系管理员获取帮助。</p>
            <p>此致<br/>Auth System 团队</p>
          </div>
        `
      };

      // 开发环境下检查SMTP配置
      if (process.env.NODE_ENV === 'development') {
        if (!env.SMTP_PASS) {
          logger.info('📧 [DEV] Account locked email would be sent (SMTP_PASS not configured):', {
            to,
            durationMinutes
          });
          return;
        }
      }

      // 发送邮件
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('📧 Account locked email sent successfully:', {
        to,
        messageId: info.messageId
      });
    } catch (error) {
      logger.error('❌ Failed to send account locked email:', {
        to,
        durationMinutes,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new InternalError('邮件发送失败，请稍后重试', 'EMAIL_SEND_FAILED', {
        type: 'account_locked',
        to,
        durationMinutes
      });
    }
  }
}
