import { Context } from 'koa';
import { SubscriptionService } from '../services/subscription.service';
import { ForbiddenError } from '../errors/custom-errors';

const subscriptionService = new SubscriptionService();

export class SubscriptionController {
  async subscribe(ctx: Context) {
    const authorId = ctx.params.authorId;
    const subscriberId = ctx.state.user.id || ctx.state.user.sub;

    await subscriptionService.subscribe(subscriberId, authorId);

    ctx.body = {
      success: true,
      message: '订阅成功'
    };
  }

  async unsubscribe(ctx: Context) {
    const authorId = ctx.params.authorId;
    const subscriberId = ctx.state.user.id || ctx.state.user.sub;

    await subscriptionService.unsubscribe(subscriberId, authorId);

    ctx.body = {
      success: true,
      message: '取消订阅成功'
    };
  }

  async getSubscriptions(ctx: Context) {
    const userId = ctx.params.userId;
    const currentUserId = ctx.state.user.id || ctx.state.user.sub;
    const currentUserRole = ctx.state.user.roles?.[0];

    if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
      throw new ForbiddenError('无权访问此资源');
    }

    const limit = ctx.query.limit ? parseInt(ctx.query.limit as string) : undefined;
    const offset = ctx.query.offset ? parseInt(ctx.query.offset as string) : undefined;

    const result = await subscriptionService.getSubscriptions(userId, {
      limit,
      offset,
    });

    ctx.body = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }

  async checkSubscription(ctx: Context) {
    const authorId = ctx.params.authorId;
    const subscriberId = ctx.state.user.id || ctx.state.user.sub;

    const isSubscribed = await subscriptionService.isSubscribed(
      subscriberId,
      authorId
    );

    ctx.body = {
      success: true,
      data: {
        isSubscribed
      }
    };
  }
}