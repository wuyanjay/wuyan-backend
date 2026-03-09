import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../errors/custom-errors';

export class SubscriptionService {
  async subscribe(subscriberId: string, authorId: string) {
    if (subscriberId === authorId) {
      throw new BadRequestError('不能订阅自己');
    }

    const author = await prisma.user.findUnique({
      where: { id: authorId },
    });

    if (!author) {
      throw new NotFoundError('作者不存在');
    }

    return await prisma.subscription.create({
      data: {
        subscriberId,
        authorId,
      },
    });
  }

  async unsubscribe(subscriberId: string, authorId: string) {
    await prisma.subscription.delete({
      where: {
        subscriberId_authorId: {
          subscriberId,
          authorId,
        },
      },
    });
  }

  async isSubscribed(subscriberId: string, authorId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
      where: {
        subscriberId_authorId: {
          subscriberId,
          authorId,
        },
      },
    });

    return !!subscription;
  }

  async getSubscriptions(userId: string, options: {
    limit?: number;
    offset?: number;
  } = {}) {
    const { limit = 20, offset = 0 } = options;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          subscriberId: userId,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatar: true,
              bio: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.subscription.count({
        where: {
          subscriberId: userId,
        },
      }),
    ]);

    return {
      data: subscriptions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }
}