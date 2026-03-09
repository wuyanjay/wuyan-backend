# 统计分析接口文档

本文档描述了博客统计分析相关的API接口，所有接口均符合 [stats-analytics-solution.md](./stats-analytics-solution.md) 中定义的规范。

## 目录

- [接口概述](#接口概述)
- [通用说明](#通用说明)
- [统计接口](#统计接口)
- [订阅接口](#订阅接口)
- [数据模型](#数据模型)
- [错误码](#错误码)

## 接口概述

本模块提供以下功能：

1. **用户统计数据** - 获取用户的浏览量、订阅者数、发布数等统计信息
2. **详细分析** - 获取指定时间段的详细分析数据，包括趋势、每日明细、热门文章等
3. **订阅管理** - 用户可以订阅/取消订阅作者，查看订阅列表

所有接口都需要用户认证，且只能访问自己的数据（管理员除外）。

## 通用说明

### 认证

所有接口都需要在请求头中携带有效的访问令牌：

```
Authorization: Bearer <access_token>
```

### 权限

- 普通用户只能访问自己的统计数据
- 管理员可以访问所有用户的统计数据

### 响应格式

成功响应：

```json
{
  "success": true,
  "data": { ... }
}
```

错误响应：

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "错误描述"
}
```

## 统计接口

### 1. 获取用户统计概览

获取用户的基本统计数据，包括总浏览量、订阅者数、发布数、与上一周期的对比，以及可选的「最近创建」与「最近浏览」博客列表（用于仪表盘等展示）。

**接口地址：** `GET /api/users/:userId/stats`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |

**查询参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| includeRecentCreated | boolean | 否 | true | 是否在响应中包含最近创建的博客列表 |
| includeRecentViewed | boolean | 否 | true | 是否在响应中包含最近浏览的博客列表 |
| recentCreatedLimit | number | 否 | 10 | 最近创建数量上限（1–50） |
| recentViewedLimit | number | 否 | 10 | 最近浏览数量上限（1–50） |
| recentCreatedOffset | number | 否 | 0 | 最近创建分页偏移 |
| recentViewedOffset | number | 否 | 0 | 最近浏览分页偏移 |
| recentCreatedStatus | string | 否 | - | 最近创建按状态过滤：DRAFT / PUBLISHED / ARCHIVED |

**请求示例：**

```bash
GET /api/users/550e8400-e29b-41d4-a716-446655440000/stats
GET /api/users/550e8400-e29b-41d4-a716-446655440000/stats?recentCreatedLimit=5&recentViewedLimit=5
GET /api/users/550e8400-e29b-41d4-a716-446655440000/stats?includeRecentViewed=false
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应示例：**

```json
{
  "success": true,
  "data": {
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
    "previousPeriodEnd": "2024-12-28T00:00:00Z",
    "recentCreated": {
      "data": [
        {
          "id": "uuid",
          "title": "文章标题",
          "slug": "article-slug",
          "excerpt": "摘要",
          "coverImage": "https://...",
          "status": "PUBLISHED",
          "categoryId": "uuid",
          "category": { "id": "uuid", "name": "分类名", "slug": "cat-slug" },
          "tags": [{ "id": "uuid", "name": "标签名", "slug": "tag-slug", "color": "#FF0000" }],
          "viewCount": 1234,
          "likeCount": 56,
          "commentCount": 23,
          "publishedAt": "2024-01-20T10:30:00Z",
          "createdAt": "2024-01-15T08:00:00Z",
          "updatedAt": "2024-01-20T10:30:00Z"
        }
      ],
      "pagination": { "total": 45, "limit": 10, "offset": 0, "hasMore": true }
    },
    "recentViewed": {
      "data": [
        {
          "viewedAt": "2024-01-28T14:20:00Z",
          "post": {
            "id": "uuid",
            "title": "文章标题",
            "slug": "article-slug",
            "excerpt": "摘要",
            "coverImage": "https://...",
            "status": "PUBLISHED",
            "author": { "id": "uuid", "username": "author_name", "nickname": "作者昵称", "avatar": "https://..." },
            "category": { "id": "uuid", "name": "分类名称", "slug": "category-slug" },
            "tags": [{ "id": "uuid", "name": "标签名", "slug": "tag-slug", "color": "#FF0000" }],
            "viewCount": 1234,
            "likeCount": 56,
            "commentCount": 23,
            "publishedAt": "2024-01-20T10:30:00Z"
          }
        }
      ],
      "pagination": { "total": 120, "limit": 10, "offset": 0, "hasMore": true }
    }
  }
}
```

**字段说明：**

- `totalViews` - 总浏览量统计
  - `current` - 当前周期浏览量
  - `previous` - 上一周期浏览量
  - `change` - 变化量（当前 - 上一周期）
  - `changePercent` - 变化百分比
  - `period` - 统计周期描述

- `readers` - 订阅者统计
  - `current` - 当前订阅者数
  - `previous` - 上一周期订阅者数
  - `change` - 变化量
  - `changePercent` - 变化百分比
  - `period` - 统计周期描述

- `published` - 发布文章统计
  - `current` - 本月发布数
  - `previous` - 上月发布数
  - `change` - 变化量
  - `changePercent` - 变化百分比
  - `period` - 统计周期描述

- `recentCreated`（可选）- 当前用户最近创建的博客
  - `data` - 文章列表，按 `createdAt` 倒序
  - `pagination` - `total`、`limit`、`offset`、`hasMore`

- `recentViewed`（可选）- 当前用户最近浏览的博客
  - `data` - 项为 `{ viewedAt, post }`，按 `viewedAt` 倒序
  - `pagination` - `total`、`limit`、`offset`、`hasMore`

**错误响应：**

```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "无权访问此资源"
}
```

### 2. 获取详细分析数据

获取指定时间段的详细分析数据，包括概览、趋势、每日明细和热门文章。

**接口地址：** `GET /api/users/:userId/analytics`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |

**查询参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| period | number | 否 | 30 | 统计周期（天数），可选 7、30、90 |
| metrics | string | 否 | - | 指定指标，逗号分隔（如：views,subscribers,posts,engagement） |

**请求示例：**

```bash
GET /api/users/550e8400-e29b-41d4-a716-446655440000/analytics?period=30&metrics=views,subscribers
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应示例：**

```json
{
  "success": true,
  "data": {
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
    ],
    "topPosts": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "Understanding AI Models",
        "slug": "understanding-ai-models",
        "viewCount": 234,
        "likeCount": 45,
        "commentCount": 12,
        "publishedAt": "2025-01-20T10:00:00Z"
      }
    ]
  }
}
```

**字段说明：**

- `period` - 统计周期信息
  - `days` - 统计天数
  - `start` - 开始时间
  - `end` - 结束时间

- `overview` - 概览数据
  - `totalViews` - 总浏览量
  - `totalSubscribers` - 总订阅者数
  - `totalPublished` - 总发布数
  - `averageViewsPerPost` - 平均每篇文章浏览量
  - `engagementRate` - 参与度（点赞+评论）/浏览量 * 100

- `trends` - 趋势数据
  - `views` - 浏览量趋势
    - `current` - 当前周期值
    - `previous` - 上一周期值
    - `change` - 变化百分比
    - `trend` - 趋势方向（up/down/stable）

- `dailyBreakdown` - 每日明细数组
  - `date` - 日期（YYYY-MM-DD）
  - `views` - 当日浏览量
  - `newSubscribers` - 当日新增订阅者
  - `published` - 当日发布文章数

- `topPosts` - 热门文章数组（按浏览量降序）
  - `id` - 文章ID
  - `title` - 文章标题
  - `slug` - 文章slug
  - `viewCount` - 浏览量
  - `likeCount` - 点赞数
  - `commentCount` - 评论数
  - `publishedAt` - 发布时间

### 2.5 记录文章浏览

用于记录当前用户对某篇文章的浏览，以便在统计概览中展示「最近浏览」列表。需认证。

**接口地址：** `POST /api/posts/:id/view`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 文章ID |

**请求示例：**

```bash
POST /api/posts/550e8400-e29b-41d4-a716-446655440001/view
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应示例：**

```json
{
  "success": true,
  "message": "浏览记录已更新"
}
```

**错误响应：**

- 文章不存在时返回 404、`error: "NOT_FOUND"`、`message: "文章不存在"`。

## 订阅接口

### 3. 订阅作者

订阅指定作者。

**接口地址：** `POST /api/users/:authorId/subscribe`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| authorId | string | 是 | 作者ID |

**请求示例：**

```bash
POST /api/users/550e8400-e29b-41d4-a716-446655440001/subscribe
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应示例：**

```json
{
  "success": true,
  "message": "订阅成功"
}
```

**错误响应：**

```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "不能订阅自己"
}
```

### 4. 取消订阅作者

取消订阅指定作者。

**接口地址：** `DELETE /api/users/:authorId/subscribe`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| authorId | string | 是 | 作者ID |

**请求示例：**

```bash
DELETE /api/users/550e8400-e29b-41d4-a716-446655440001/subscribe
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应示例：**

```json
{
  "success": true,
  "message": "取消订阅成功"
}
```

### 5. 获取订阅列表

获取用户订阅的所有作者列表。

**接口地址：** `GET /api/users/:userId/subscriptions`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |

**查询参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| limit | number | 否 | 20 | 每页数量 |
| offset | number | 否 | 0 | 偏移量 |

**请求示例：**

```bash
GET /api/users/550e8400-e29b-41d4-a716-446655440000/subscriptions?limit=20&offset=0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "subscriberId": "550e8400-e29b-41d4-a716-446655440000",
      "authorId": "550e8400-e29b-41d4-a716-446655440001",
      "author": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "username": "author1",
        "nickname": "Author One",
        "avatar": "https://example.com/avatar1.jpg",
        "bio": "This is author bio"
      },
      "createdAt": "2024-12-01T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

**字段说明：**

- `data` - 订阅列表数组
  - `id` - 订阅记录ID
  - `subscriberId` - 订阅者ID
  - `authorId` - 作者ID
  - `author` - 作者信息
    - `id` - 作者ID
    - `username` - 用户名
    - `nickname` - 昵称
    - `avatar` - 头像URL
    - `bio` - 简介
  - `createdAt` - 订阅时间

- `pagination` - 分页信息
  - `total` - 总记录数
  - `limit` - 每页数量
  - `offset` - 偏移量
  - `hasMore` - 是否还有更多数据

### 6. 检查订阅状态

检查当前用户是否已订阅指定作者。

**接口地址：** `GET /api/users/:authorId/subscribe/check`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| authorId | string | 是 | 作者ID |

**请求示例：**

```bash
GET /api/users/550e8400-e29b-41d4-a716-446655440001/subscribe/check
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "isSubscribed": true
  }
}
```

**字段说明：**

- `isSubscribed` - 是否已订阅（true/false）

## 数据模型

### Metric

指标数据结构：

```typescript
interface Metric {
  current: number;        // 当前值
  previous: number;       // 上一周期值
  change: number;         // 变化量
  changePercent: number;   // 变化百分比
  period: string;         // 周期描述
}
```

### Trend

趋势数据结构：

```typescript
interface Trend {
  current: number;        // 当前值
  previous: number;       // 上一周期值
  change: number;         // 变化百分比
  trend: 'up' | 'down' | 'stable';  // 趋势方向
}
```

### DailyBreakdown

每日明细数据结构：

```typescript
interface DailyBreakdown {
  date: string;          // 日期 (YYYY-MM-DD)
  views: number;         // 浏览量
  newSubscribers: number; // 新增订阅者
  published: number;     // 发布文章数
}
```

### TopPost

热门文章数据结构：

```typescript
interface TopPost {
  id: string;            // 文章ID
  title: string;         // 标题
  slug: string;          // slug
  viewCount: number;     // 浏览量
  likeCount: number;     // 点赞数
  commentCount: number;   // 评论数
  publishedAt: string;   // 发布时间
}
```

## 错误码

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| UNAUTHORIZED | 401 | 未授权，访问令牌无效或过期 |
| FORBIDDEN | 403 | 无权访问此资源 |
| NOT_FOUND | 404 | 资源不存在（如用户不存在） |
| BAD_REQUEST | 400 | 请求参数错误（如订阅自己） |
| INTERNAL_SERVER_ERROR | 500 | 服务器内部错误 |

## 性能指标

根据文档要求，接口应满足以下性能指标：

1. **响应时间** - 统计接口响应时间应 < 500ms（正常数据量）
2. **并发支持** - 支持至少 100 并发请求
3. **缓存策略** - 统计数据使用 Redis 缓存，缓存时间 10 分钟
4. **数据库优化** - 使用适当的索引优化查询性能

## 安全要求

1. **认证** - 所有接口都需要有效的访问令牌
2. **授权** - 用户只能访问自己的统计数据（管理员除外）
3. **输入验证** - 所有输入参数都经过验证
4. **SQL注入防护** - 使用 Prisma ORM 防止 SQL 注入
5. **XSS防护** - 对用户输入进行适当的转义

## 测试

项目包含完整的单元测试，位于 `tests/unit/services/` 目录：

- `stats.service.test.ts` - 统计服务测试
- `subscription.service.test.ts` - 订阅服务测试

运行测试：

```bash
npm test
```

## 更新日志

### v1.0.0 (2025-01-28)

- 初始版本
- 实现用户统计概览接口
- 实现详细分析接口
- 实现订阅管理接口
- 添加完整的单元测试
