# 博客统计数据接口设计方案（扩展版）

## 一、新增数据库模型

### 1.1 订阅关系表

当前 schema 缺少订阅功能，需要新增：

```prisma
model Subscription {
  id           String   @id @default(uuid()) @db.Uuid
  subscriberId String   @map("subscriber_id") @db.Uuid
  authorId     String   @map("author_id") @db.Uuid
  
  subscriber   User     @relation("UserSubscriptions", fields: [subscriberId], references: [id], onDelete: Cascade)
  author       User     @relation("AuthorSubscribers", fields: [authorId], references: [id], onDelete: Cascade)
  
  createdAt    DateTime @default(now()) @map("created_at")
  
  @@unique([subscriberId, authorId])
  @@index([subscriberId])
  @@index([authorId, createdAt(sort: Desc)])
  @@map("subscriptions")
}

model PostView {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  postId    String   @map("post_id") @db.Uuid
  viewedAt  DateTime @default(now()) @map("viewed_at")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  @@unique([userId, postId])
  @@index([userId, viewedAt(sort: Desc)])
  @@index([postId, viewedAt(sort: Desc)])
  @@map("post_views")
}
```

### 1.2 更新 User 模型

```prisma
model User {
  // ... 现有字段
  
  // 关联关系
  posts              Post[]
  comments           Comment[]
  postViews          PostView[]
  
  // 订阅关系
  subscriptions      Subscription[] @relation("UserSubscriptions")  // 我订阅的作者
  subscribers        Subscription[] @relation("AuthorSubscribers")  // 订阅我的读者
}
```

### 1.3 更新 Post 模型

```prisma
model Post {
  // ... 现有字段
  views      PostView[]
}
```

## 二、统计 API 接口设计

### 2.1 获取用户统计数据

```
GET /api/users/:userId/stats
```

**响应示例：**

```json
{
  "totalViews": {
    "current": 1248,
    "previous": 1114,
    "change": 134,
    "changePercent": 12.03,
    "period": "30 days"
  },
  "readers": {
    "current": 840,
    "previous": 800,
    "change": 40,
    "changePercent": 5.00,
    "period": "active subscribers"
  },
  "published": {
    "current": 24,
    "previous": 22,
    "change": 2,
    "changePercent": 9.09,
    "period": "this month"
  },
  "periodStart": "2024-12-28T00:00:00Z",
  "periodEnd": "2025-01-28T00:00:00Z",
  "previousPeriodStart": "2024-11-28T00:00:00Z",
  "previousPeriodEnd": "2024-12-28T00:00:00Z"
}
```

### 2.2 获取详细统计报告

```
GET /api/users/:userId/analytics
```

**查询参数：**
- `period`: 统计周期（7, 30, 90 天，默认 30）
- `metrics`: 指定指标（views, subscribers, posts, engagement）

**响应示例：**

```json
{
  "period": {
    "days": 30,
    "start": "2024-12-28T00:00:00Z",
    "end": "2025-01-28T00:00:00Z"
  },
  "overview": {
    "totalViews": 1248,
    "totalSubscribers": 840,
    "totalPublished": 24,
    "averageViewsPerPost": 52,
    "engagementRate": 6.73
  },
  "trends": {
    "views": {
      "current": 1248,
      "previous": 1114,
      "change": 12.03,
      "trend": "up"
    },
    "subscribers": {
      "current": 840,
      "previous": 800,
      "change": 5.00,
      "trend": "up"
    },
    "published": {
      "current": 24,
      "previous": 22,
      "change": 9.09,
      "trend": "up"
    }
  },
  "dailyBreakdown": [
    {
      "date": "2025-01-28",
      "views": 58,
      "newSubscribers": 3,
      "published": 1
    }
    // ... 更多日期
  ],
  "topPosts": [
    {
      "id": "uuid",
      "title": "Understanding AI Models",
      "views": 234,
      "likes": 45,
      "comments": 12,
      "publishedAt": "2025-01-20T10:00:00Z"
    }
  ]
}
```

## 三、服务层实现

### 3.1 StatsService

```typescript
import { PrismaClient } from '@prisma/client';

export class StatsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 获取用户统计概览
   */
  async getUserStats(userId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // 并行查询所有统计数据
    const [
      currentViews,
      previousViews,
      currentSubscribers,
      previousSubscribers,
      currentPublished,
      previousPublished,
    ] = await Promise.all([
      // 当前周期的总浏览量
      this.getTotalViewsForPeriod(userId, thirtyDaysAgo, now),
      
      // 上一周期的总浏览量
      this.getTotalViewsForPeriod(userId, sixtyDaysAgo, thirtyDaysAgo),
      
      // 当前活跃订阅者数
      this.getActiveSubscribers(userId),
      
      // 30天前的订阅者数
      this.getSubscribersAtDate(userId, thirtyDaysAgo),
      
      // 本月发布数
      this.getPublishedCountForMonth(userId, now),
      
      // 上月发布数
      this.getPublishedCountForMonth(userId, this.getPreviousMonth(now)),
    ]);

    return {
      totalViews: this.calculateMetric(
        currentViews,
        previousViews,
        '30 days'
      ),
      readers: this.calculateMetric(
        currentSubscribers,
        previousSubscribers,
        'active subscribers'
      ),
      published: this.calculateMetric(
        currentPublished,
        previousPublished,
        'this month'
      ),
      periodStart: thirtyDaysAgo.toISOString(),
      periodEnd: now.toISOString(),
      previousPeriodStart: sixtyDaysAgo.toISOString(),
      previousPeriodEnd: thirtyDaysAgo.toISOString(),
    };
  }

  /**
   * 获取指定时间段的总浏览量
   */
  private async getTotalViewsForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // 获取用户在此期间的所有文章
    const posts = await this.prisma.post.findMany({
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

    // 统计这些文章在指定时间段的浏览量
    const viewCount = await this.prisma.postView.count({
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

  /**
   * 获取当前活跃订阅者数
   */
  private async getActiveSubscribers(userId: string): Promise<number> {
    return await this.prisma.subscription.count({
      where: {
        authorId: userId,
      },
    });
  }

  /**
   * 获取指定日期时的订阅者数
   */
  private async getSubscribersAtDate(
    userId: string,
    date: Date
  ): Promise<number> {
    return await this.prisma.subscription.count({
      where: {
        authorId: userId,
        createdAt: {
          lte: date,
        },
      },
    });
  }

  /**
   * 获取指定月份的发布文章数
   */
  private async getPublishedCountForMonth(
    userId: string,
    date: Date
  ): Promise<number> {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

    return await this.prisma.post.count({
      where: {
        authorId: userId,
        status: 'PUBLISHED',
        publishedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });
  }

  /**
   * 计算指标变化
   */
  private calculateMetric(
    current: number,
    previous: number,
    period: string
  ) {
    const change = current - previous;
    const changePercent = previous === 0 
      ? (current > 0 ? 100 : 0)
      : ((change / previous) * 100);

    return {
      current,
      previous,
      change,
      changePercent: parseFloat(changePercent.toFixed(2)),
      period,
    };
  }

  /**
   * 获取上个月的日期
   */
  private getPreviousMonth(date: Date): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() - 1);
    return result;
  }

  /**
   * 获取详细分析数据
   */
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

    // 计算平均值和参与度
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

  /**
   * 获取时间段内发布的文章数
   */
  private async getPublishedCountForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return await this.prisma.post.count({
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

  /**
   * 获取每日统计明细
   */
  private async getDailyBreakdown(
    userId: string,
    startDate: Date,
    endDate: Date
  ) {
    // 获取用户的所有文章ID
    const posts = await this.prisma.post.findMany({
      where: {
        authorId: userId,
      },
      select: {
        id: true,
      },
    });

    const postIds = posts.map(p => p.id);

    // 按日期聚合浏览数据
    const viewsByDate = await this.prisma.$queryRaw<Array<{
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

    // 按日期聚合订阅数据
    const subscribersByDate = await this.prisma.$queryRaw<Array<{
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

    // 按日期聚合发布数据
    const publishedByDate = await this.prisma.$queryRaw<Array<{
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

    // 合并数据
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

  /**
   * 获取热门文章
   */
  private async getTopPosts(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number
  ) {
    const posts = await this.prisma.post.findMany({
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

  /**
   * 获取总参与度（点赞 + 评论）
   */
  private async getTotalEngagement(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await this.prisma.post.aggregate({
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

  /**
   * 计算趋势
   */
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
```

### 3.2 SubscriptionService

```typescript
export class SubscriptionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 订阅作者
   */
  async subscribe(subscriberId: string, authorId: string) {
    if (subscriberId === authorId) {
      throw new Error('不能订阅自己');
    }

    // 检查作者是否存在
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
    });

    if (!author) {
      throw new Error('作者不存在');
    }

    return await this.prisma.subscription.create({
      data: {
        subscriberId,
        authorId,
      },
    });
  }

  /**
   * 取消订阅
   */
  async unsubscribe(subscriberId: string, authorId: string) {
    await this.prisma.subscription.delete({
      where: {
        subscriberId_authorId: {
          subscriberId,
          authorId,
        },
      },
    });
  }

  /**
   * 检查是否已订阅
   */
  async isSubscribed(subscriberId: string, authorId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: {
        subscriberId_authorId: {
          subscriberId,
          authorId,
        },
      },
    });

    return !!subscription;
  }

  /**
   * 获取订阅列表
   */
  async getSubscriptions(userId: string, options: {
    limit?: number;
    offset?: number;
  } = {}) {
    const { limit = 20, offset = 0 } = options;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
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
      this.prisma.subscription.count({
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
```

## 四、控制器实现

### 4.1 StatsController

```typescript
import { Request, Response, NextFunction } from 'express';
import { StatsService } from '../services/stats.service';

export class StatsController {
  constructor(private statsService: StatsService) {}

  /**
   * GET /api/users/:userId/stats
   */
  async getUserStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      // 权限检查
      if (req.user.id !== userId && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: '无权访问此资源',
        });
      }

      const stats = await this.statsService.getUserStats(userId);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/:userId/analytics
   */
  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { period, metrics } = req.query;

      // 权限检查
      if (req.user.id !== userId && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: '无权访问此资源',
        });
      }

      const analytics = await this.statsService.getAnalytics(userId, {
        period: period ? parseInt(period as string) : undefined,
        metrics: metrics ? (metrics as string).split(',') : undefined,
      });

      res.json(analytics);
    } catch (error) {
      next(error);
    }
  }
}
```

### 4.2 SubscriptionController

```typescript
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  /**
   * POST /api/users/:authorId/subscribe
   */
  async subscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const { authorId } = req.params;
      const subscriberId = req.user.id;

      await this.subscriptionService.subscribe(subscriberId, authorId);

      res.json({
        success: true,
        message: '订阅成功',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/users/:authorId/subscribe
   */
  async unsubscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const { authorId } = req.params;
      const subscriberId = req.user.id;

      await this.subscriptionService.unsubscribe(subscriberId, authorId);

      res.json({
        success: true,
        message: '取消订阅成功',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/:userId/subscriptions
   */
  async getSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { limit, offset } = req.query;

      // 权限检查
      if (req.user.id !== userId && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: '无权访问此资源',
        });
      }

      const result = await this.subscriptionService.getSubscriptions(userId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/:authorId/subscribe/check
   */
  async checkSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const { authorId } = req.params;
      const subscriberId = req.user.id;

      const isSubscribed = await this.subscriptionService.isSubscribed(
        subscriberId,
        authorId
      );

      res.json({
        isSubscribed,
      });
    } catch (error) {
      next(error);
    }
  }
}
```

## 五、路由配置

```typescript
import { Router } from 'express';
import { StatsController } from '../controllers/stats.controller';
import { SubscriptionController } from '../controllers/subscription.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// 需要认证
router.use(authenticateToken);

// 统计相关
router.get(
  '/users/:userId/stats',
  (req, res, next) => statsController.getUserStats(req, res, next)
);

router.get(
  '/users/:userId/analytics',
  (req, res, next) => statsController.getAnalytics(req, res, next)
);

// 订阅相关
router.post(
  '/users/:authorId/subscribe',
  (req, res, next) => subscriptionController.subscribe(req, res, next)
);

router.delete(
  '/users/:authorId/subscribe',
  (req, res, next) => subscriptionController.unsubscribe(req, res, next)
);

router.get(
  '/users/:userId/subscriptions',
  (req, res, next) => subscriptionController.getSubscriptions(req, res, next)
);

router.get(
  '/users/:authorId/subscribe/check',
  (req, res, next) => subscriptionController.checkSubscription(req, res, next)
);

export default router;
```

## 六、数据库迁移

### 6.1 创建迁移

```bash
npx prisma migrate dev --name add_subscriptions_and_stats
```

### 6.2 迁移 SQL

```sql
-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscriber_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_subscriber_id_idx" ON "subscriptions"("subscriber_id");

-- CreateIndex
CREATE INDEX "subscriptions_author_id_created_at_idx" ON "subscriptions"("author_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_subscriber_id_author_id_key" ON "subscriptions"("subscriber_id", "author_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriber_id_fkey" 
    FOREIGN KEY ("subscriber_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_author_id_fkey" 
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## 七、性能优化

### 7.1 使用物化视图（可选）

对于大量数据的统计，可以创建物化视图：

```sql
-- 创建用户统计物化视图
CREATE MATERIALIZED VIEW user_stats_daily AS
SELECT 
    p.author_id,
    DATE(pv.viewed_at) as stat_date,
    COUNT(DISTINCT pv.user_id) as unique_viewers,
    COUNT(*) as total_views,
    COUNT(DISTINCT p.id) as posts_published
FROM posts p
LEFT JOIN post_views pv ON p.id = pv.post_id
WHERE p.status = 'PUBLISHED'
GROUP BY p.author_id, DATE(pv.viewed_at);

-- 创建索引
CREATE INDEX idx_user_stats_daily_author ON user_stats_daily(author_id, stat_date DESC);

-- 定时刷新（每小时）
REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats_daily;
```

### 7.2 Redis 缓存统计数据

```typescript
import Redis from 'ioredis';

export class CachedStatsService extends StatsService {
  constructor(
    prisma: PrismaClient,
    private redis: Redis
  ) {
    super(prisma);
  }

  async getUserStats(userId: string) {
    const cacheKey = `user:${userId}:stats`;
    
    // 尝试从缓存获取
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 缓存未命中，查询数据库
    const stats = await super.getUserStats(userId);
    
    // 缓存结果（10分钟）
    await this.redis.setex(cacheKey, 600, JSON.stringify(stats));
    
    return stats;
  }

  /**
   * 清除用户统计缓存
   */
  async invalidateUserStats(userId: string) {
    await this.redis.del(`user:${userId}:stats`);
  }
}
```

### 7.3 后台定时计算

```typescript
import cron from 'node-cron';

export class StatsScheduler {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  /**
   * 每小时预计算所有活跃用户的统计数据
   */
  start() {
    // 每小时的第5分钟执行
    cron.schedule('5 * * * *', async () => {
      console.log('开始预计算用户统计数据...');
      
      try {
        // 获取最近30天有活动的用户
        const activeUsers = await this.getActiveUsers();
        
        for (const userId of activeUsers) {
          const stats = await this.calculateUserStats(userId);
          await this.cacheUserStats(userId, stats);
        }
        
        console.log(`已预计算 ${activeUsers.length} 个用户的统计数据`);
      } catch (error) {
        console.error('预计算统计数据失败:', error);
      }
    });
  }

  private async getActiveUsers(): Promise<string[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            posts: {
              some: {
                createdAt: {
                  gte: thirtyDaysAgo,
                },
              },
            },
          },
          {
            lastLoginAt: {
              gte: thirtyDaysAgo,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return users.map(u => u.id);
  }

  private async calculateUserStats(userId: string) {
    const statsService = new StatsService(this.prisma);
    return await statsService.getUserStats(userId);
  }

  private async cacheUserStats(userId: string, stats: any) {
    const cacheKey = `user:${userId}:stats`;
    await this.redis.setex(cacheKey, 3600, JSON.stringify(stats));
  }
}
```

## 八、前端调用示例

### 8.1 React Hooks

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

export function useUserStats(userId: string) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/users/${userId}/stats`);
        setStats(response.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  return { stats, loading, error };
}

export function useAnalytics(userId: string, period: number = 30) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/users/${userId}/analytics`, {
          params: { period },
        });
        setAnalytics(response.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [userId, period]);

  return { analytics, loading, error };
}
```

### 8.2 Dashboard 组件

```tsx
import React from 'react';
import { useUserStats } from '../hooks/useUserStats';

interface StatCardProps {
  title: string;
  value: number;
  change: number;
  changePercent: number;
  period: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, change, changePercent, period, icon }: StatCardProps) {
  const isPositive = change >= 0;
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
        <div className="text-green-500">{icon}</div>
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value.toLocaleString()}</span>
        <span className={`text-sm font-medium ${changeColor}`}>
          {isPositive ? '+' : ''}{changePercent}%
        </span>
      </div>
      
      <p className="text-gray-500 text-xs mt-2">
        vs. previous {period}
      </p>
    </div>
  );
}

function Dashboard({ userId }: { userId: string }) {
  const { stats, loading, error } = useUserStats(userId);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading stats</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Welcome back, Writer</h1>
      <p className="text-gray-600 mb-8">Here's what's happening with your blogs today.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="TOTAL VIEWS"
          value={stats.totalViews.current}
          change={stats.totalViews.change}
          changePercent={stats.totalViews.changePercent}
          period={stats.totalViews.period}
          icon={<EyeIcon className="w-5 h-5" />}
        />

        <StatCard
          title="READERS"
          value={stats.readers.current}
          change={stats.readers.change}
          changePercent={stats.readers.changePercent}
          period={stats.readers.period}
          icon={<UsersIcon className="w-5 h-5" />}
        />

        <StatCard
          title="PUBLISHED"
          value={stats.published.current}
          change={stats.published.change}
          changePercent={stats.published.changePercent}
          period={stats.published.period}
          icon={<DocumentIcon className="w-5 h-5" />}
        />
      </div>
    </div>
  );
}

export default Dashboard;
```

## 九、测试示例

### 9.1 单元测试

```typescript
describe('StatsService', () => {
  describe('getUserStats', () => {
    it('应该返回正确的统计数据', async () => {
      const stats = await statsService.getUserStats(userId);

      expect(stats.totalViews).toBeDefined();
      expect(stats.totalViews.current).toBeGreaterThanOrEqual(0);
      expect(stats.totalViews.changePercent).toBeDefined();
      
      expect(stats.readers).toBeDefined();
      expect(stats.published).toBeDefined();
    });

    it('应该正确计算百分比变化', async () => {
      // 假设上期100次浏览，本期120次浏览
      const stats = await statsService.getUserStats(userId);
      
      // 变化应该是 +20%
      expect(stats.totalViews.changePercent).toBeCloseTo(20, 2);
    });

    it('当上期为0时应该处理正确', async () => {
      // 创建新用户，只有本期数据
      const newUserId = await createTestUser();
      const stats = await statsService.getUserStats(newUserId);
      
      // 变化百分比应该是100%（从0到任何正数）
      if (stats.totalViews.current > 0) {
        expect(stats.totalViews.changePercent).toBe(100);
      }
    });
  });

  describe('getAnalytics', () => {
    it('应该返回详细的分析数据', async () => {
      const analytics = await statsService.getAnalytics(userId, {
        period: 30,
      });

      expect(analytics.period.days).toBe(30);
      expect(analytics.overview).toBeDefined();
      expect(analytics.trends).toBeDefined();
      expect(analytics.dailyBreakdown).toBeInstanceOf(Array);
      expect(analytics.topPosts).toBeInstanceOf(Array);
    });
  });
});
```

## 十、总结

这个扩展方案提供了：

✅ **完整的统计功能**：总浏览量、订阅者数、发布数  
✅ **同比分析**：与上一周期对比，显示变化百分比  
✅ **订阅系统**：用户可以订阅作者  
✅ **详细分析**：每日明细、热门文章、趋势分析  
✅ **性能优化**：Redis缓存、物化视图、后台定时计算  
✅ **前端集成**：React Hooks 和组件示例  

**关键特性：**
- 30天为周期的对比统计
- 实时计算 + 缓存结合
- 支持多维度分析
- 可扩展的指标系统

**下一步建议：**
1. 实现数据库迁移
2. 部署 Redis
3. 配置定时任务
4. 前端集成展示
5. 监控性能指标
