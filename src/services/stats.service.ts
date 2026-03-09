import prisma from '../config/database';

export class StatsService {
  async getUserStats(userId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const [
      currentViews,
      previousViews,
      currentSubscribers,
      previousSubscribers,
      currentPublished,
      previousPublished,
    ] = await Promise.all([
      this.getTotalViewsForPeriod(userId, thirtyDaysAgo, now),
      this.getTotalViewsForPeriod(userId, sixtyDaysAgo, thirtyDaysAgo),
      this.getActiveSubscribers(userId),
      this.getSubscribersAtDate(userId, thirtyDaysAgo),
      this.getPublishedCountForPeriod(userId, thirtyDaysAgo, now),
      this.getPublishedCountForPeriod(userId, sixtyDaysAgo, thirtyDaysAgo),
    ]);

    return {
      totalViews: this.calculateMetric(
        currentViews,
        previousViews,
        '最近30天'
      ),
      readers: this.calculateMetric(
        currentSubscribers,
        previousSubscribers,
        '最近30天'
      ),
      published: this.calculateMetric(
        currentPublished,
        previousPublished,
        '最近30天'
      ),
      periodStart: thirtyDaysAgo.toISOString(),
      periodEnd: now.toISOString(),
      previousPeriodStart: sixtyDaysAgo.toISOString(),
      previousPeriodEnd: thirtyDaysAgo.toISOString(),
    };
  }

  private async getTotalViewsForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
        publishedAt: {
          lte: endDate,
        },
      },
      select: {
        id: true,
      },
    });

    const postIds = posts.map(p => p.id);

    if (postIds.length === 0) return 0;

    const viewCount = await prisma.postView.count({
      where: {
        postId: {
          in: postIds,
        },
        viewedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    return viewCount;
  }

  private async getActiveSubscribers(userId: string): Promise<number> {
    return await prisma.subscription.count({
      where: {
        authorId: userId,
      },
    });
  }

  private async getSubscribersAtDate(
    userId: string,
    date: Date
  ): Promise<number> {
    return await prisma.subscription.count({
      where: {
        authorId: userId,
        createdAt: {
          lte: date,
        },
      },
    });
  }

  private calculateMetric(
    current: number,
    previous: number,
    period: string
  ) {
    const change = current - previous;
    let changePercent = 0;

    if (previous === 0) {
      changePercent = current > 0 ? 100 : 0;
    } else {
      changePercent = (change / previous) * 100;
    }

    return {
      current,
      previous,
      change,
      changePercent: parseFloat(changePercent.toFixed(2)),
      period,
    };
  }

  async getAnalytics(
    userId: string,
    options: {
      period?: number;
      metrics?: string[];
    } = {}
  ) {
    const { period = 30 } = options;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - period);

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(startDate.getDate() - period);

    const [
      totalViews,
      previousViews,
      totalSubscribers,
      previousSubscribers,
      totalPublished,
      previousPublished,
      dailyStats,
      topPosts,
    ] = await Promise.all([
      this.getTotalViewsForPeriod(userId, startDate, now),
      this.getTotalViewsForPeriod(userId, previousStartDate, startDate),
      this.getActiveSubscribers(userId),
      this.getSubscribersAtDate(userId, startDate),
      this.getPublishedCountForPeriod(userId, startDate, now),
      this.getPublishedCountForPeriod(userId, previousStartDate, startDate),
      this.getDailyBreakdown(userId, startDate, now),
      this.getTopPosts(userId, startDate, now, 10),
    ]);

    const averageViewsPerPost = totalPublished > 0
      ? totalViews / totalPublished
      : 0;

    const totalEngagement = await this.getTotalEngagement(userId, startDate, now);
    const engagementRate = totalViews > 0
      ? (totalEngagement / totalViews) * 100
      : 0;

    return {
      period: {
        days: period,
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      overview: {
        totalViews,
        totalSubscribers,
        totalPublished,
        averageViewsPerPost: parseFloat(averageViewsPerPost.toFixed(2)),
        engagementRate: parseFloat(engagementRate.toFixed(2)),
      },
      trends: {
        views: this.calculateTrend(totalViews, previousViews),
        subscribers: this.calculateTrend(totalSubscribers, previousSubscribers),
        published: this.calculateTrend(totalPublished, previousPublished),
      },
      dailyBreakdown: dailyStats,
      topPosts,
    };
  }

  private async getPublishedCountForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return await prisma.post.count({
      where: {
        authorId: userId,
        status: 'PUBLISHED',
        publishedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });
  }

  private async getDailyBreakdown(
    userId: string,
    startDate: Date,
    endDate: Date
  ) {
    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
      },
      select: {
        id: true,
      },
    });

    const postIds = posts.map(p => p.id);

    const viewsByDate = await prisma.$queryRaw<Array<{
      date: Date;
      views: bigint;
    }>>`
      SELECT 
        DATE(viewed_at) as date,
        COUNT(*) as views
      FROM post_views
      WHERE post_id = ANY(${postIds}::uuid[])
        AND viewed_at >= ${startDate}
        AND viewed_at < ${endDate}
      GROUP BY DATE(viewed_at)
      ORDER BY date DESC
    `;

    const subscribersByDate = await prisma.$queryRaw<Array<{
      date: Date;
      new_subscribers: bigint;
    }>>`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_subscribers
      FROM subscriptions
      WHERE author_id = ${userId}::uuid
        AND created_at >= ${startDate}
        AND created_at < ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const publishedByDate = await prisma.$queryRaw<Array<{
      date: Date;
      published: bigint;
    }>>`
      SELECT 
        DATE(published_at) as date,
        COUNT(*) as published
      FROM posts
      WHERE author_id = ${userId}::uuid
        AND status = 'PUBLISHED'
        AND published_at >= ${startDate}
        AND published_at < ${endDate}
      GROUP BY DATE(published_at)
      ORDER BY date DESC
    `;

    const dateMap = new Map<string, any>();

    viewsByDate.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      dateMap.set(dateStr, {
        date: dateStr,
        views: Number(row.views),
        newSubscribers: 0,
        published: 0,
      });
    });

    subscribersByDate.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      const existing = dateMap.get(dateStr) || {
        date: dateStr,
        views: 0,
        newSubscribers: 0,
        published: 0,
      };
      existing.newSubscribers = Number(row.new_subscribers);
      dateMap.set(dateStr, existing);
    });

    publishedByDate.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      const existing = dateMap.get(dateStr) || {
        date: dateStr,
        views: 0,
        newSubscribers: 0,
        published: 0,
      };
      existing.published = Number(row.published);
      dateMap.set(dateStr, existing);
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  private async getTopPosts(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number
  ) {
    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
        status: 'PUBLISHED',
        publishedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        publishedAt: true,
      },
      orderBy: {
        viewCount: 'desc',
      },
      take: limit,
    });

    return posts;
  }

  private async getTotalEngagement(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await prisma.post.aggregate({
      where: {
        authorId: userId,
        publishedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: {
        likeCount: true,
        commentCount: true,
      },
    });

    return (result._sum.likeCount || 0) + (result._sum.commentCount || 0);
  }

  private calculateTrend(current: number, previous: number) {
    const change = current - previous;
    const changePercent = previous === 0
      ? (current > 0 ? 100 : 0)
      : ((change / previous) * 100);

    return {
      current,
      previous,
      change: parseFloat(changePercent.toFixed(2)),
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
    };
  }
}