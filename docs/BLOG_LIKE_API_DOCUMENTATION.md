# 博客点赞接口技术文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0.0 |
| 最后更新 | 2025-01-29 |
| 维护者 | 后端开发团队 |
| 文档状态 | 正式发布 |

---

## 目录

1. [接口概览](#接口概览)
2. [接口详情](#接口详情)
   - [2.1 切换点赞状态](#21-切换点赞状态)
   - [2.2 获取点赞状态](#22-获取点赞状态)
   - [2.3 获取文章点赞用户列表](#23-获取文章点赞用户列表)
   - [2.4 获取用户点赞的文章列表](#24-获取用户点赞的文章列表)
3. [数据模型](#数据模型)
4. [错误码说明](#错误码说明)
5. [权限要求](#权限要求)
6. [限流策略](#限流策略)
7. [接口变更历史](#接口变更历史)

---

## 接口概览

本模块提供博客文章点赞功能，支持用户对文章进行点赞、取消点赞、查询点赞状态、查看点赞用户列表以及查看用户点赞的文章列表。

### 接口列表

| 序号 | 接口名称 | HTTP方法 | 路径 | 认证要求 | 限流 |
|------|----------|-----------|------|----------|------|
| 1 | 切换点赞状态 | POST | `/api/posts/:id/like` | 必需 | 是 |
| 2 | 获取点赞状态 | GET | `/api/posts/:id/like/status` | 可选 | 否 |
| 3 | 获取文章点赞用户列表 | GET | `/api/posts/:id/likers` | 不需要 | 否 |
| 4 | 获取用户点赞的文章列表 | GET | `/api/posts/liked` | 必需 | 否 |

---

## 接口详情

### 2.1 切换点赞状态

#### 基本信息

| 项目 | 内容 |
|------|------|
| 接口名称 | 切换点赞状态 |
| 接口路径 | `/api/posts/:id/like` |
| HTTP方法 | POST |
| 接口描述 | 切换用户对指定文章的点赞状态。如果用户已点赞则取消点赞，如果未点赞则进行点赞 |
| 权限要求 | 需要用户登录认证 |
| 限流策略 | 30次/分钟/用户 |

#### 请求参数

##### 路径参数

| 参数名 | 数据类型 | 必填 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | string (UUID) | 是 | - | 文章ID |

##### 请求头参数

| 参数名 | 数据类型 | 必填 | 说明 | 示例 |
|--------|----------|------|------|------|
| Authorization | string | 是 | Bearer Token 认证 | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| Content-Type | string | 否 | 请求内容类型 | `application/json` |

##### 请求体参数

无

#### 响应数据

##### 成功响应（点赞成功）

**HTTP状态码：** 200

**响应体：**
```json
{
  "success": true,
  "message": "点赞成功",
  "data": {
    "isLiked": true,
    "likeCount": 42
  }
}
```

##### 成功响应（取消点赞成功）

**HTTP状态码：** 200

**响应体：**
```json
{
  "success": true,
  "message": "取消点赞成功",
  "data": {
    "isLiked": false,
    "likeCount": 41
  }
}
```

##### 响应字段说明

| 字段名 | 数据类型 | 说明 |
|--------|----------|------|
| success | boolean | 请求是否成功 |
| message | string | 操作结果提示信息 |
| data.isLiked | boolean | 当前点赞状态：true=已点赞，false=未点赞 |
| data.likeCount | number | 文章总点赞数 |

##### 错误响应

**HTTP状态码：** 404

**响应体：**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "文章不存在"
}
```

**HTTP状态码：** 401

**响应体：**
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "未授权，请先登录"
}
```

**HTTP状态码：** 429

**响应体：**
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "请求过于频繁，请稍后再试"
}
```

#### 接口调用示例

##### cURL 示例

```bash
# 点赞文章
curl -X POST http://localhost:3000/api/posts/550e8400-e29b-41d4-a716-446655440001/like \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" \
  -H "Content-Type: application/json"
```

##### JavaScript/Fetch 示例

```javascript
const toggleLike = async (postId) => {
  try {
    const response = await fetch(`http://localhost:3000/api/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      console.log('操作成功:', result.message);
      console.log('当前点赞状态:', result.data.isLiked);
      console.log('总点赞数:', result.data.likeCount);
    } else {
      console.error('操作失败:', result.message);
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
};

// 调用示例
toggleLike('550e8400-e29b-41d4-a716-446655440001');
```

##### Axios 示例

```javascript
import axios from 'axios';

const toggleLike = async (postId) => {
  try {
    const response = await axios.post(
      `/api/posts/${postId}/like`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('操作成功:', response.data.message);
    console.log('当前点赞状态:', response.data.data.isLiked);
    console.log('总点赞数:', response.data.data.likeCount);
  } catch (error) {
    if (error.response) {
      console.error('错误:', error.response.data.message);
    } else {
      console.error('请求失败:', error.message);
    }
  }
};
```

---

### 2.2 获取点赞状态

#### 基本信息

| 项目 | 内容 |
|------|------|
| 接口名称 | 获取点赞状态 |
| 接口路径 | `/api/posts/:id/like/status` |
| HTTP方法 | GET |
| 接口描述 | 查询指定文章的点赞状态和总点赞数。如果用户已登录，返回用户是否已点赞；如果未登录，isLiked 字段始终为 false |
| 权限要求 | 可选认证（推荐登录以获取个人点赞状态） |
| 限流策略 | 无 |

#### 请求参数

##### 路径参数

| 参数名 | 数据类型 | 必填 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | string (UUID) | 是 | - | 文章ID |

##### 请求头参数

| 参数名 | 数据类型 | 必填 | 说明 | 示例 |
|--------|----------|------|------|------|
| Authorization | string | 否 | Bearer Token 认证（可选） | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

##### 查询参数

无

##### 请求体参数

无

#### 响应数据

##### 成功响应（已登录用户）

**HTTP状态码：** 200

**响应体：**
```json
{
  "success": true,
  "data": {
    "isLiked": true,
    "likeCount": 42
  }
}
```

##### 成功响应（未登录用户）

**HTTP状态码：** 200

**响应体：**
```json
{
  "success": true,
  "data": {
    "isLiked": false,
    "likeCount": 42
  }
}
```

##### 响应字段说明

| 字段名 | 数据类型 | 说明 |
|--------|----------|------|
| success | boolean | 请求是否成功 |
| data.isLiked | boolean | 当前用户是否已点赞该文章（未登录时始终为 false） |
| data.likeCount | number | 文章总点赞数 |

##### 错误响应

**HTTP状态码：** 404

**响应体：**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "文章不存在"
}
```

#### 接口调用示例

##### cURL 示例

```bash
# 未登录查询
curl -X GET http://localhost:3000/api/posts/550e8400-e29b-41d4-a716-446655440001/like/status

# 已登录查询
curl -X GET http://localhost:3000/api/posts/550e8400-e29b-41d4-a716-446655440001/like/status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

##### JavaScript/Fetch 示例

```javascript
const getLikeStatus = async (postId, accessToken = null) => {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`http://localhost:3000/api/posts/${postId}/like/status`, {
      method: 'GET',
      headers
    });

    const result = await response.json();

    if (result.success) {
      console.log('总点赞数:', result.data.likeCount);
      console.log('当前用户是否已点赞:', result.data.isLiked);
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
};

// 调用示例
getLikeStatus('550e8400-e29b-41d4-a716-446655440001', accessToken);
```

---

### 2.3 获取文章点赞用户列表

#### 基本信息

| 项目 | 内容 |
|------|------|
| 接口名称 | 获取文章点赞用户列表 |
| 接口路径 | `/api/posts/:id/likers` |
| HTTP方法 | GET |
| 接口描述 | 分页获取指定文章的所有点赞用户列表，按点赞时间倒序排列 |
| 权限要求 | 不需要认证 |
| 限流策略 | 无 |

#### 请求参数

##### 路径参数

| 参数名 | 数据类型 | 必填 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | string (UUID) | 是 | - | 文章ID |

##### 查询参数

| 参数名 | 数据类型 | 必填 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| page | integer | 否 | 1 | 页码，从 1 开始 |
| limit | integer | 否 | 20 | 每页数量，最大值为 100 |

##### 请求头参数

无特殊要求

##### 请求体参数

无

#### 响应数据

##### 成功响应

**HTTP状态码：** 200

**响应体：**
```json
{
  "success": true,
  "data": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "nickname": "John Doe",
      "avatar": "https://example.com/avatars/john.jpg",
      "likedAt": "2025-01-29T10:30:00.000Z"
    },
    {
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "username": "jane_smith",
      "nickname": "Jane Smith",
      "avatar": "https://example.com/avatars/jane.jpg",
      "likedAt": "2025-01-29T09:15:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

##### 响应字段说明

**data 数组字段：**

| 字段名 | 数据类型 | 说明 |
|--------|----------|------|
| userId | string (UUID) | 用户ID |
| username | string | 用户名 |
| nickname | string | 用户昵称 |
| avatar | string | 用户头像URL（可能为 null） |
| likedAt | string (ISO 8601) | 点赞时间 |

**pagination 字段：**

| 字段名 | 数据类型 | 说明 |
|--------|----------|------|
| total | integer | 总记录数 |
| page | integer | 当前页码 |
| limit | integer | 每页数量 |
| totalPages | integer | 总页数 |

##### 错误响应

**HTTP状态码：** 404

**响应体：**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "文章不存在"
}
```

#### 接口调用示例

##### cURL 示例

```bash
# 获取第一页数据（默认）
curl -X GET http://localhost:3000/api/posts/550e8400-e29b-41d4-a716-446655440001/likers

# 获取第二页数据，每页 10 条
curl -X GET "http://localhost:3000/api/posts/550e8400-e29b-41d4-a716-446655440001/likers?page=2&limit=10"
```

##### JavaScript/Fetch 示例

```javascript
const getPostLikers = async (postId, page = 1, limit = 20) => {
  try {
    const response = await fetch(
      `http://localhost:3000/api/posts/${postId}/likers?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('点赞用户列表:', result.data);
      console.log('分页信息:', result.pagination);

      // 遍历点赞用户
      result.data.forEach(user => {
        console.log(`${user.nickname} (${user.username}) - 点赞于 ${user.likedAt}`);
      });
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
};

// 调用示例
getPostLikers('550e8400-e29b-41d4-a716-446655440001', 1, 20);
```

---

### 2.4 获取用户点赞的文章列表

#### 基本信息

| 项目 | 内容 |
|------|------|
| 接口名称 | 获取用户点赞的文章列表 |
| 接口路径 | `/api/posts/liked` |
| HTTP方法 | GET |
| 接口描述 | 分页获取当前登录用户点赞的所有文章列表，按点赞时间倒序排列 |
| 权限要求 | 需要用户登录认证 |
| 限流策略 | 无 |

#### 请求参数

##### 路径参数

无

##### 查询参数

| 参数名 | 数据类型 | 必填 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| page | integer | 否 | 1 | 页码，从 1 开始 |
| limit | integer | 否 | 20 | 每页数量，最大值为 100 |

##### 请求头参数

| 参数名 | 数据类型 | 必填 | 说明 | 示例 |
|--------|----------|------|------|------|
| Authorization | string | 是 | Bearer Token 认证 | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

##### 请求体参数

无

#### 响应数据

##### 成功响应

**HTTP状态码：** 200

**响应体：**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "如何使用 TypeScript 开发 Node.js 应用",
      "slug": "typescript-nodejs-guide",
      "excerpt": "本文将详细介绍如何使用 TypeScript 来开发 Node.js 应用程序...",
      "coverImage": "https://example.com/covers/ts-nodejs.jpg",
      "status": "PUBLISHED",
      "author": {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "username": "tech_writer",
        "nickname": "技术博主",
        "avatar": "https://example.com/avatars/tech.jpg"
      },
      "category": {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "name": "技术",
        "slug": "technology"
      },
      "tags": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440004",
          "name": "TypeScript",
          "slug": "typescript",
          "color": "#3178c6"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440005",
          "name": "Node.js",
          "slug": "nodejs",
          "color": "#68a063"
        }
      ],
      "viewCount": 1520,
      "likeCount": 42,
      "commentCount": 15,
      "publishedAt": "2025-01-28T10:00:00.000Z",
      "likedAt": "2025-01-29T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

##### 响应字段说明

**data 数组字段：**

| 字段名 | 数据类型 | 说明 |
|--------|----------|------|
| id | string (UUID) | 文章ID |
| title | string | 文章标题 |
| slug | string | 文章URL别名 |
| excerpt | string | 文章摘要（可能为 null） |
| coverImage | string | 文章封面图URL（可能为 null） |
| status | string | 文章状态：DRAFT（草稿）、PUBLISHED（已发布）、ARCHIVED（已归档） |
| author | object | 作者信息 |
| author.id | string (UUID) | 作者ID |
| author.username | string | 作者用户名 |
| author.nickname | string | 作者昵称（可能为 null） |
| author.avatar | string | 作者头像URL（可能为 null） |
| category | object | 分类信息（可能为 null） |
| category.id | string (UUID) | 分类ID |
| category.name | string | 分类名称 |
| category.slug | string | 分类URL别名 |
| tags | array | 标签列表 |
| tags[].id | string (UUID) | 标签ID |
| tags[].name | string | 标签名称 |
| tags[].slug | string | 标签URL别名 |
| tags[].color | string | 标签颜色（可能为 null） |
| viewCount | integer | 浏览次数 |
| likeCount | integer | 点赞次数 |
| commentCount | integer | 评论次数 |
| publishedAt | string (ISO 8601) | 发布时间（可能为 null） |
| likedAt | string (ISO 8601) | 用户点赞时间 |

**pagination 字段：**

| 字段名 | 数据类型 | 说明 |
|--------|----------|------|
| total | integer | 总记录数 |
| page | integer | 当前页码 |
| limit | integer | 每页数量 |
| totalPages | integer | 总页数 |

##### 错误响应

**HTTP状态码：** 401

**响应体：**
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "未授权，请先登录"
}
```

#### 接口调用示例

##### cURL 示例

```bash
# 获取第一页数据（默认）
curl -X GET http://localhost:3000/api/posts/liked \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 获取第二页数据，每页 10 条
curl -X GET "http://localhost:3000/api/posts/liked?page=2&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

##### JavaScript/Fetch 示例

```javascript
const getUserLikedPosts = async (accessToken, page = 1, limit = 20) => {
  try {
    const response = await fetch(
      `http://localhost:3000/api/posts/liked?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('点赞文章列表:', result.data);
      console.log('分页信息:', result.pagination);

      // 遍历点赞的文章
      result.data.forEach(post => {
        console.log(`${post.title} - 点赞于 ${post.likedAt}`);
      });
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
};

// 调用示例
getUserLikedPosts(accessToken, 1, 20);
```

---

## 数据模型

### PostLike 表结构

| 字段名 | 数据类型 | 说明 | 约束 |
|--------|----------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| userId | UUID | 用户ID | FOREIGN KEY → users.id, NOT NULL |
| postId | UUID | 文章ID | FOREIGN KEY → posts.id, NOT NULL |
| createdAt | TIMESTAMP | 创建时间 | DEFAULT NOW() |

**索引：**
- `UNIQUE (userId, postId)` - 防止重复点赞
- `INDEX (userId, createdAt DESC)` - 优化用户点赞列表查询
- `INDEX (postId, createdAt DESC)` - 优化文章点赞用户列表查询

### LikeStatus 接口

```typescript
interface LikeStatus {
  isLiked: boolean;   // 是否已点赞
  likeCount: number;  // 总点赞数
}
```

---

## 错误码说明

### 错误码列表

| 错误码 | HTTP状态码 | 错误名称 | 错误信息 | 处理建议 |
|--------|-----------|----------|----------|----------|
| NOT_FOUND | 404 | 资源不存在 | 文章不存在 | 检查文章ID是否正确，确认文章是否存在 |
| UNAUTHORIZED | 401 | 未授权 | 未授权，请先登录 | 检查Token是否有效，是否已过期 |
| FORBIDDEN | 403 | 禁止访问 | 无权限访问此资源 | 检查用户权限，确认是否有权访问 |
| CONFLICT | 409 | 冲突 | 已经点赞过该文章 / 未点赞过该文章 | 检查当前点赞状态，避免重复操作 |
| RATE_LIMIT_EXCEEDED | 429 | 请求过于频繁 | 请求过于频繁，请稍后再试 | 降低请求频率，等待限流重置 |
| INTERNAL_SERVER_ERROR | 500 | 服务器内部错误 | 服务器内部错误 | 联系技术支持，稍后重试 |

### 错误响应格式

所有错误响应遵循统一格式：

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

**字段说明：**

| 字段名 | 数据类型 | 说明 |
|--------|----------|------|
| success | boolean | 固定为 false |
| error | string | 错误码（大写字母和下划线） |
| message | string | 人类可读的错误信息 |
| details | object | 额外的错误详情（可选） |

### 错误处理最佳实践

#### 前端错误处理示例

```javascript
const handleLikeError = (error) => {
  if (error.response) {
    const { status, data } = error.response;

    switch (status) {
      case 404:
        console.error('文章不存在');
        alert('文章不存在或已被删除');
        break;
      case 401:
        console.error('未授权');
        // 跳转到登录页
        window.location.href = '/login';
        break;
      case 409:
        console.error('操作冲突');
        alert(data.message);
        // 刷新当前状态
        refreshLikeStatus();
        break;
      case 429:
        console.error('请求过于频繁');
        alert('操作过于频繁，请稍后再试');
        break;
      case 500:
        console.error('服务器错误');
        alert('服务器错误，请稍后重试');
        break;
      default:
        console.error('未知错误');
        alert('操作失败，请稍后重试');
    }
  } else {
    console.error('网络错误');
    alert('网络连接失败，请检查网络');
  }
};
```

---

## 权限要求

### 认证方式

本接口使用 **Bearer Token** 认证方式，基于 JWT（JSON Web Token）。

#### Token 获取

用户通过登录接口获取 Token：

```bash
POST /api/auth/login
```

#### Token 使用

在请求头中添加 Authorization 字段：

```
Authorization: Bearer <your-jwt-token>
```

### 权限矩阵

| 接口 | 未登录用户 | 已登录用户 | 说明 |
|------|-----------|-----------|------|
| POST /api/posts/:id/like | ❌ 禁止 | ✅ 允许 | 需要用户身份 |
| GET /api/posts/:id/like/status | ✅ 允许 | ✅ 允许 | 未登录时 isLiked 为 false |
| GET /api/posts/:id/likers | ✅ 允许 | ✅ 允许 | 公开数据 |
| GET /api/posts/liked | ❌ 禁止 | ✅ 允许 | 需要用户身份 |

### Token 刷新

Token 有效期通常为 1 小时，过期后需要使用 Refresh Token 刷新：

```bash
POST /api/auth/refresh
```

---

## 限流策略

### 限流规则

| 接口 | 时间窗口 | 最大请求数 | 限流键 |
|------|----------|-----------|---------|
| POST /api/posts/:id/like | 60秒 | 30次 | `like:{userId}` |
| GET /api/posts/:id/like/status | 无限制 | - | - |
| GET /api/posts/:id/likers | 无限制 | - | - |
| GET /api/posts/liked | 无限制 | - | - |

### 限流响应

当触发限流时，返回以下响应：

**HTTP状态码：** 429

**响应体：**
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "请求过于频繁，请稍后再试"
}
```

### 限流处理建议

#### 前端处理

```javascript
let likeRequestCount = 0;
let likeRequestResetTime = Date.now() + 60000;

const checkRateLimit = () => {
  const now = Date.now();
  if (now > likeRequestResetTime) {
    likeRequestCount = 0;
    likeRequestResetTime = now + 60000;
  }
  return likeRequestCount < 30;
};

const toggleLike = async (postId) => {
  if (!checkRateLimit()) {
    alert('操作过于频繁，请稍后再试');
    return;
  }

  likeRequestCount++;

  try {
    const response = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const result = await response.json();

    if (result.success) {
      console.log('操作成功');
    } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
      alert('操作过于频繁，请稍后再试');
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
};
```

---

## 接口变更历史

### v1.0.0 (2025-01-29)

#### 新增功能

1. **新增点赞功能模块**
   - 新增 `POST /api/posts/:id/like` 接口 - 切换点赞状态
   - 新增 `GET /api/posts/:id/like/status` 接口 - 获取点赞状态
   - 新增 `GET /api/posts/:id/likers` 接口 - 获取文章点赞用户列表
   - 新增 `GET /api/posts/liked` 接口 - 获取用户点赞的文章列表

2. **数据库变更**
   - 新增 `PostLike` 数据表
   - 在 `User` 表中添加 `postLikes` 关联
   - 在 `Post` 表中添加 `likes` 关联

3. **功能特性**
   - 支持点赞/取消点赞切换
   - 防止重复点赞（数据库唯一约束）
   - 支持分页查询
   - 支持可选认证（点赞状态查询）
   - 实现限流保护（30次/分钟）
   - 原子操作保证数据一致性

#### 技术实现

- 使用 Prisma ORM 进行数据库操作
- 使用 Koa 框架构建 RESTful API
- 使用 JWT 进行身份认证
- 使用自定义中间件实现限流
- 使用统一错误处理机制

---

## 附录

### A. 完整的 TypeScript 类型定义

```typescript
// 点赞状态
interface LikeStatus {
  isLiked: boolean;
  likeCount: number;
}

// 点赞用户信息
interface PostLiker {
  userId: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  likedAt: string;
}

// 分页响应
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 文章信息
interface PostInfo {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  author: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
  }>;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string | null;
  likedAt: string;
}

// 成功响应
interface SuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: any;
}
```

### B. 测试用例

#### 测试用例 1：点赞文章

```javascript
describe('点赞文章接口测试', () => {
  it('应该成功点赞文章', async () => {
    const response = await request(app)
      .post('/api/posts/550e8400-e29b-41d4-a716-446655440001/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.isLiked).toBe(true);
    expect(response.body.data.likeCount).toBeGreaterThan(0);
  });

  it('未登录应该返回401', async () => {
    const response = await request(app)
      .post('/api/posts/550e8400-e29b-41d4-a716-446655440001/like')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('UNAUTHORIZED');
  });

  it('文章不存在应该返回404', async () => {
    const response = await request(app)
      .post('/api/posts/00000000-0000-0000-0000-000000000000/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('NOT_FOUND');
  });
});
```

#### 测试用例 2：获取点赞状态

```javascript
describe('获取点赞状态接口测试', () => {
  it('已登录用户应该返回正确的点赞状态', async () => {
    const response = await request(app)
      .get('/api/posts/550e8400-e29b-41d4-a716-446655440001/like/status')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.isLiked).toBe('boolean');
    expect(typeof response.body.data.likeCount).toBe('number');
  });

  it('未登录用户应该返回isLiked为false', async () => {
    const response = await request(app)
      .get('/api/posts/550e8400-e29b-41d4-a716-446655440001/like/status')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.isLiked).toBe(false);
  });
});
```

### C. 常见问题 (FAQ)

**Q1: 为什么切换点赞接口返回的 likeCount 与实际不符？**

A: 切换点赞接口返回的是操作后的最新点赞数，如果前端显示的点赞数与接口返回不一致，可能是缓存问题。建议在收到响应后立即更新前端状态。

**Q2: 如何处理并发点赞？**

A: 系统使用数据库唯一约束 `UNIQUE (userId, postId)` 防止重复点赞，并发请求不会导致数据不一致。前端可以通过防抖（debounce）减少不必要的请求。

**Q3: 限流重置时间是多久？**

A: 限流时间窗口为 60 秒，每分钟重置一次计数器。建议前端在触发限流后等待 60 秒再重试。

**Q4: 如何获取用户点赞的所有文章？**

A: 使用 `GET /api/posts/liked` 接口，支持分页查询。该接口需要用户登录认证。

**Q5: 点赞数据会实时更新吗？**

A: 点赞操作是实时的，但前端可能需要轮询或使用 WebSocket 来获取实时的点赞数更新。

---

## 联系方式

如有任何问题或建议，请联系：

- **技术支持邮箱：** support@example.com
- **GitHub Issues：** https://github.com/example/auth-backend/issues
- **文档更新：** 请提交 Pull Request 或联系维护者

---

**文档结束**