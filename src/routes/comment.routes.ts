import Router from 'koa-router';
import { CommentController } from '../controllers/comment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { rateLimitMiddleware } from '../middlewares/ratelimit.middleware';

const router = new Router({ prefix: '/api/comments' });
const commentController = new CommentController();

// 速率限制
const commentRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,  // 1分钟
  maxRequests: 5,       // 最多5条评论
  keyGenerator: (ctx) => `comment:${ctx.state.user.id || ctx.state.user.sub}`
});

// 公开路由
router.get('/post/:postId', (ctx) => commentController.getPostComments(ctx));

// 需要认证的路由
router.post('/', authMiddleware, commentRateLimit, (ctx) => commentController.createComment(ctx));
router.delete('/:id', authMiddleware, (ctx) => commentController.deleteComment(ctx));

export default router;
