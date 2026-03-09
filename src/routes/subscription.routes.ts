import Router from 'koa-router';
import { SubscriptionController } from '../controllers/subscription.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = new Router({ prefix: '/api/users' });
const subscriptionController = new SubscriptionController();

router.use(authMiddleware);

router.post('/:authorId/subscribe', (ctx) => subscriptionController.subscribe(ctx));
router.delete('/:authorId/subscribe', (ctx) => subscriptionController.unsubscribe(ctx));
router.get('/:userId/subscriptions', (ctx) => subscriptionController.getSubscriptions(ctx));
router.get('/:authorId/subscribe/check', (ctx) => subscriptionController.checkSubscription(ctx));

export default router;