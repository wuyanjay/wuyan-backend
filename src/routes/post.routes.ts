import Router from 'koa-router';
import { PostController } from '../controllers/post.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { rateLimitMiddleware } from '../middlewares/ratelimit.middleware';

const router = new Router({ prefix: '/api/posts' });
const postController = new PostController();

// 速率限制
const postCreateRateLimit = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000,  // 1小时
  maxRequests: 10,            // 最多创建10篇文章
  keyGenerator: (ctx) => `post:create:${ctx.state.user.id || ctx.state.user.sub}`
});

// 公开路由
router.get('/', (ctx) => postController.getPostList(ctx));
router.get('/my', authMiddleware, (ctx) => postController.getMyPosts(ctx));
// 文章详情：可选登录，登录时写入用户浏览记录（需在 /:id 之前注册更具体路径）
router.get('/:id/edit', authMiddleware, (ctx) => postController.getPostForEdit(ctx));
router.get('/:id', optionalAuthMiddleware, (ctx) => postController.getPostById(ctx));

// 需要认证的路由
router.post('/', authMiddleware, postCreateRateLimit, (ctx) => postController.createPost(ctx));
router.put('/:id', authMiddleware, (ctx) => postController.updatePost(ctx));
router.delete('/:id', authMiddleware, (ctx) => postController.deletePost(ctx));

export default router;
