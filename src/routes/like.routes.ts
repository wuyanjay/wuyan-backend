import Router from 'koa-router';
import { LikeController } from '../controllers/like.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { rateLimitMiddleware } from '../middlewares/ratelimit.middleware';

const router = new Router({ prefix: '/api/posts' });
const likeController = new LikeController();

const likeRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyGenerator: (ctx) => `like:${ctx.state.user.id || ctx.state.user.sub}`
});

router.post('/:id/like', authMiddleware, likeRateLimit, (ctx) => likeController.toggleLike(ctx));
router.get('/:id/like/status', optionalAuthMiddleware, (ctx) => likeController.getLikeStatus(ctx));
router.get('/:id/likers', (ctx) => likeController.getPostLikers(ctx));
router.get('/liked', authMiddleware, (ctx) => likeController.getUserLikedPosts(ctx));

export default router;