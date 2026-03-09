# 我的博客 API 接口文档

本文档描述了获取当前用户博客列表的相关接口。

**基础 URL**: `http://localhost:3000/api` (开发环境)

**通用响应结构**:
所有接口均返回统一的 JSON 格式：

```json
{
  "success": true,        // 请求是否成功
  "message": "描述信息",   // 成功或错误提示
  "data": { ... }         // 实际业务数据，失败时为 null
}
```

---

## 目录

1. [获取我的博客列表](#1-获取我的博客列表)
2. [删除博客](#2-删除博客)

---

## 1. 获取我的博客列表

获取当前用户的所有博客，支持分页、状态筛选和搜索。

- **接口路径**: `/posts/my`
- **请求方法**: `GET`
- **认证要求**: 需要（需要有效的 JWT token）

### 请求头

```http
Authorization: Bearer <your_jwt_token>
```

### 请求参数 (Query Parameters)

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `page` | number | 否 | 1 | 当前页码，必须 >= 1 |
| `pageSize` | number | 否 | 10 | 每页显示的博客数，1-100 |
| `status` | string | 否 | - | 状态筛选：`DRAFT`（草稿）、`PUBLISHED`（公开）、`ARCHIVED`（归档） |
| `search` | string | 否 | - | 搜索关键词，匹配标题或摘要（不区分大小写） |

### 请求示例

```bash
# 获取所有博客（不分状态）
GET /api/posts/my?page=1&pageSize=10

# 获取草稿
GET /api/posts/my?page=1&pageSize=10&status=DRAFT

# 获取公开的博客
GET /api/posts/my?page=1&pageSize=10&status=PUBLISHED

# 获取归档的博客
GET /api/posts/my?page=1&pageSize=10&status=ARCHIVED

# 搜索博客（匹配标题或摘要）
GET /api/posts/my?page=1&pageSize=10&search=技术

# 搜索草稿中的博客
GET /api/posts/my?page=1&pageSize=10&status=DRAFT&search=技术
```

### 成功响应 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "ec7ce332-8a6a-45de-87f9-57e78ac3f0da",
      "title": "我的第一篇博客",
      "slug": "my-first-blog-post",
      "excerpt": "这是博客摘要",
      "coverImage": "https://example.com/cover.jpg",
      "status": "PUBLISHED",
      "viewCount": 150,
      "likeCount": 12,
      "commentCount": 5,
      "publishedAt": "2026-02-03T10:00:00.000Z",
      "createdAt": "2026-02-02T10:30:00.000Z",
      "updatedAt": "2026-02-03T10:00:00.000Z",
      "category": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "技术",
        "slug": "tech"
      },
      "tags": [
        {
          "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          "name": "前端",
          "slug": "frontend",
          "color": "#3498DB"
        }
      ]
    },
    {
      "id": "f3g4h5i6-j7k8-9012-cdef-234567890123",
      "title": "草稿博客",
      "slug": "draft-blog-post",
      "excerpt": "这是一篇草稿",
      "coverImage": null,
      "status": "DRAFT",
      "viewCount": 0,
      "likeCount": 0,
      "commentCount": 0,
      "publishedAt": null,
      "createdAt": "2026-02-03T08:00:00.000Z",
      "updatedAt": "2026-02-03T08:00:00.000Z",
      "category": null,
      "tags": []
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `data` | Array | 博客列表 |
| `data[].id` | string | 博客唯一标识（UUID） |
| `data[].title` | string | 博客标题 |
| `data[].slug` | string | 博客 URL 标识 |
| `data[].excerpt` | string \| null | 博客摘要 |
| `data[].coverImage` | string \| null | 封面图片 URL |
| `data[].status` | string | 博客状态：`DRAFT`（草稿）、`PUBLISHED`（公开）、`ARCHIVED`（归档） |
| `data[].viewCount` | number | 浏览次数 |
| `data[].likeCount` | number | 点赞数 |
| `data[].commentCount` | number | 评论数 |
| `data[].publishedAt` | string \| null | 发布时间（ISO 8601），草稿时为 null |
| `data[].createdAt` | string | 创建时间（ISO 8601） |
| `data[].updatedAt` | string | 更新时间（ISO 8601） |
| `data[].category` | Object \| null | 分类信息 |
| `data[].category.id` | string | 分类 ID |
| `data[].category.name` | string | 分类名称 |
| `data[].category.slug` | string | 分类 URL 标识 |
| `data[].tags` | Array | 标签列表 |
| `data[].tags[].id` | string | 标签 ID |
| `data[].tags[].name` | string | 标签名称 |
| `data[].tags[].slug` | string | 标签 URL 标识 |
| `data[].tags[].color` | string \| null | 标签颜色 |
| `pagination` | Object | 分页信息 |
| `pagination.page` | number | 当前页码 |
| `pagination.pageSize` | number | 每页数量 |
| `pagination.total` | number | 总记录数 |
| `pagination.totalPages` | number | 总页数 |

### 错误响应

**401 Unauthorized - 未认证**

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "未提供有效的认证信息"
}
```

---

## 2. 删除博客

删除指定的博客文章。只有博客作者或管理员可以删除博客。

- **接口路径**: `/posts/:id`
- **请求方法**: `DELETE`
- **认证要求**: 需要（需要有效的 JWT token）

### 请求头

```http
Authorization: Bearer <your_jwt_token>
```

### 路径参数 (Path Parameters)

| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `id` | string | 是 | 博客唯一标识（UUID） |

### 请求示例

```bash
# 删除指定博客
DELETE /api/posts/ec7ce332-8a6a-45de-87f9-57e78ac3f0da
```

### 成功响应 (200 OK)

```json
{
  "success": true,
  "message": "文章删除成功"
}
```

### 错误响应

**401 Unauthorized - 未认证**

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "未提供有效的认证信息"
}
```

**403 Forbidden - 无权限**

```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "无权删除此文章"
}
```

**404 Not Found - 博客不存在**

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "文章不存在"
}
```

---

## 数据模型

### MyPost 对象

```typescript
interface MyPost {
  id: string;                    // UUID 格式的唯一标识
  title: string;                  // 博客标题
  slug: string;                  // URL 友好的标识符
  excerpt: string | null;        // 博客摘要
  coverImage: string | null;     // 封面图片 URL
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';  // 博客状态
  viewCount: number;             // 浏览次数
  likeCount: number;             // 点赞数
  commentCount: number;          // 评论数
  publishedAt: string | null;    // 发布时间（ISO 8601），草稿时为 null
  createdAt: string;             // 创建时间（ISO 8601）
  updatedAt: string;             // 更新时间（ISO 8601）
  category: {                     // 分类信息
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: Array<{                   // 标签列表
    id: string;
    name: string;
    slug: string;
    color: string | null;
  }>;
}
```

### MyPostsQuery

```typescript
interface MyPostsQuery {
  page?: number;       // 当前页码，默认 1
  pageSize?: number;   // 每页数量，默认 10
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';  // 状态筛选
  search?: string;     // 搜索关键词，匹配标题或摘要（不区分大小写）
}
```

---

## 注意事项

1. **认证要求**: 此接口需要有效的 JWT token，只有登录用户才能访问自己的博客列表

2. **分页参数**: 
   - `page` 必须是正整数
   - `pageSize` 范围为 1-100
   - 默认值为 `page=1`, `pageSize=10`

3. **状态筛选**:
   - 不传 `status` 参数时，返回所有状态的博客
   - 传 `status=DRAFT` 只返回草稿
   - 传 `status=PUBLISHED` 只返回公开的博客
   - 传 `status=ARCHIVED` 只返回归档的博客

4. **搜索功能**:
   - `search` 参数用于搜索博客
   - 搜索会同时匹配博客标题和摘要
   - 搜索不区分大小写
   - 可以与 `status` 参数组合使用，例如搜索草稿中的博客

5. **排序**: 博客列表按创建时间倒序排列（最新的在前）

6. **数据不包含**: 此接口不返回 `author`（作者）和 `content`（内容）字段，以减少数据传输量

7. **分类和标签**: 博客可能没有分类或标签，此时 `category` 为 `null`，`tags` 为空数组

8. **删除权限**:
   - 只有博客作者本人可以删除自己的博客
   - 管理员（`ADMIN` 角色）可以删除任意博客
   - 删除操作不可恢复，请谨慎操作

9. **级联删除**:
   - 删除博客时会同时删除相关的评论
   - 删除博客时会同时删除与标签的关联关系
   - 浏览记录、点赞记录等关联数据也会被清理

10. **缓存清理**:
    - 删除博客后会自动清理相关的缓存数据
    - 包括文章详情缓存和博客列表缓存

---

## 使用示例

### 获取所有博客

```bash
curl -X GET "http://localhost:3000/api/posts/my?page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 获取草稿列表

```bash
curl -X GET "http://localhost:3000/api/posts/my?page=1&pageSize=10&status=DRAFT" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 获取公开的博客

```bash
curl -X GET "http://localhost:3000/api/posts/my?page=1&pageSize=10&status=PUBLISHED" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 搜索博客

```bash
# 搜索包含"技术"关键词的博客
curl -X GET "http://localhost:3000/api/posts/my?page=1&pageSize=10&search=技术" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 搜索草稿中包含"技术"关键词的博客
curl -X GET "http://localhost:3000/api/posts/my?page=1&pageSize=10&status=DRAFT&search=技术" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 删除博客

```bash
# 删除指定博客
curl -X DELETE "http://localhost:3000/api/posts/ec7ce332-8a6a-45de-87f9-57e78ac3f0da" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 错误码说明

| 错误码 | HTTP 状态 | 描述 |
| :--- | :--- | :--- |
| `UNAUTHORIZED` | 401 | 未提供有效的认证信息 |
| `FORBIDDEN` | 403 | 无权执行此操作（非作者或管理员） |
| `NOT_FOUND` | 404 | 资源不存在 |
| `INTERNAL_SERVER_ERROR` | 500 | 服务器内部错误 |

---

## 更新日志

### v1.2.0 (2026-02-04)
- 新增删除博客接口
- 支持作者删除自己的博客
- 支持管理员删除任意博客
- 删除时自动清理相关缓存

### v1.1.0 (2026-02-03)
- 新增搜索功能，支持通过 `search` 参数搜索博客标题和摘要
- 搜索不区分大小写
- 搜索可以与状态筛选组合使用

### v1.0.0 (2026-02-03)
- 初始版本发布
- 实现获取当前用户博客列表功能
- 支持分页和状态筛选
- 不返回 author 和 content 字段以优化性能
