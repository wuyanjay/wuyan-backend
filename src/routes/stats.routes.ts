import Router from 'koa-router';
import { StatsController } from '../controllers/stats.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = new Router({ prefix: '/api/users' });
const statsController = new StatsController();

router.use(authMiddleware);

router.get('/:userId/stats', (ctx) => statsController.getUserStats(ctx));
router.get('/:userId/analytics', (ctx) => statsController.getAnalytics(ctx));

export default router;