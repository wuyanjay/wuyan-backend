import Router from 'koa-router';
import { TagController } from '../controllers/tag.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { rateLimitMiddleware } from '../middlewares/ratelimit.middleware';

const router = new Router({ prefix: '/api/tags' });
const tagController = new TagController();

const tagCreateRateLimit = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: (ctx) => `tag:create:${ctx.state.user.id || ctx.state.user.sub}`
});

router.get('/', (ctx) => tagController.getTagList(ctx));
router.get('/:id', (ctx) => tagController.getTagById(ctx));

router.post('/', authMiddleware, tagCreateRateLimit, (ctx) => tagController.createTag(ctx));
router.put('/:id', authMiddleware, (ctx) => tagController.updateTag(ctx));
router.delete('/:id', authMiddleware, (ctx) => tagController.deleteTag(ctx));

export default router;
