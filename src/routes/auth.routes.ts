import Router from 'koa-router';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { 
  loginRateLimiter, 
  registerRateLimiter,
  forgotPasswordRateLimiter,
  forgotPasswordEmailRateLimiter,
  resetPasswordRateLimiter
} from '../middlewares/ratelimit.middleware';

const router = new Router({ prefix: '/api/auth' });
const authController = new AuthController();

// 公开路由
router.post('/register', registerRateLimiter, authController.register.bind(authController));
router.post('/login', loginRateLimiter, authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
router.get('/verify-email', authController.verifyEmail.bind(authController));
router.post('/resend-verification-email', forgotPasswordRateLimiter, forgotPasswordEmailRateLimiter, authController.resendVerificationEmail.bind(authController));
router.post('/forgot-password', forgotPasswordRateLimiter, forgotPasswordEmailRateLimiter, authController.forgotPassword.bind(authController));
router.post('/reset-password', resetPasswordRateLimiter, authController.resetPassword.bind(authController));

// 需要认证的路由
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.get('/me', authMiddleware, authController.me.bind(authController));

export default router;
