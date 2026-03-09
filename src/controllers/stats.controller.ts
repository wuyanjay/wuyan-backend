import { Context } from 'koa';
import { PostStatus } from '@prisma/client';
import { StatsService } from '../services/stats.service';
import { PostService } from '../services/post.service';
import { ForbiddenError } from '../errors/custom-errors';
import { logger } from '../utils/logger';

const statsService = new StatsService();
const postService = new PostService();

/** 解析 stats 查询参数中的数字，限制在 [min, max] */
function parseLimit(value: unknown, def: number, min: number, max: number): number {
  if (value === undefined || value === null || value === '') return def;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(min, n), max);
}

function parseOffset(value: unknown, def: number): number {
  if (value === undefined || value === null || value === '') return def;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 0) return def;
  return n;
}

export class StatsController {
  async getUserStats(ctx: Context) {
    const userId = ctx.params.userId;
    const currentUserId = ctx.state.user.id || ctx.state.user.sub;
    const currentUserRole = ctx.state.user.roles?.[0];

    if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
      throw new ForbiddenError('无权访问此资源');
    }

    const q = ctx.query;
    const includeRecentCreated = String(q.includeRecentCreated ?? 'true').toLowerCase() !== 'false';
    const includeRecentViewed = String(q.includeRecentViewed ?? 'true').toLowerCase() !== 'false';
    const recentCreatedLimit = parseLimit(q.recentCreatedLimit, 10, 1, 50);
    const recentViewedLimit = parseLimit(q.recentViewedLimit, 10, 1, 50);
    const recentCreatedOffset = parseOffset(q.recentCreatedOffset, 0);
    const recentViewedOffset = parseOffset(q.recentViewedOffset, 0);
    const recentCreatedStatus = (q.recentCreatedStatus as string)?.toUpperCase();
    const statusFilter =
      recentCreatedStatus && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(recentCreatedStatus)
        ? (recentCreatedStatus as PostStatus)
        : undefined;

    const stats = await statsService.getUserStats(userId);
    const data: Record<string, unknown> = { ...stats };

    if (includeRecentCreated) {
      try {
        const recentCreated = await postService.getRecentCreatedPosts(userId, {
          limit: recentCreatedLimit,
          offset: recentCreatedOffset,
          status: statusFilter
        });
        data.recentCreated = recentCreated;
        logger.debug('getUserStats: included recentCreated', { userId, count: recentCreated.data.length });
      } catch (err) {
        logger.error('getUserStats: getRecentCreatedPosts failed', { userId, err });
        throw err;
      }
    }

    if (includeRecentViewed) {
      try {
        const recentViewed = await postService.getRecentViewedPosts(userId, {
          limit: recentViewedLimit,
          offset: recentViewedOffset
        });
        data.recentViewed = recentViewed;
        logger.debug('getUserStats: included recentViewed', { userId, count: recentViewed.data.length });
      } catch (err) {
        logger.error('getUserStats: getRecentViewedPosts failed', { userId, err });
        throw err;
      }
    }

    ctx.body = {
      success: true,
      data
    };
  }

  async getAnalytics(ctx: Context) {
    const userId = ctx.params.userId;
    const currentUserId = ctx.state.user.id || ctx.state.user.sub;
    const currentUserRole = ctx.state.user.roles?.[0];

    if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
      throw new ForbiddenError('无权访问此资源');
    }

    const period = ctx.query.period ? parseInt(ctx.query.period as string) : undefined;
    const metrics = ctx.query.metrics ? (ctx.query.metrics as string).split(',') : undefined;

    const analytics = await statsService.getAnalytics(userId, {
      period,
      metrics,
    });

    ctx.body = {
      success: true,
      data: analytics
    };
  }
}