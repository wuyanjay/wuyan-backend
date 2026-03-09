# 标签管理 API 接口文档

本文档描述了标签管理相关的所有接口，包括标签的创建、查询、更新和删除操作。

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

1. [创建标签](#1-创建标签)
2. [获取标签列表](#2-获取标签列表)
3. [获取标签详情](#3-获取标签详情)
4. [更新标签](#4-更新标签)
5. [删除标签](#5-删除标签)

---

## 1. 创建标签

创建一个新的标签。

- **接口路径**: `/tags`
- **请求方法**: `POST`
- **认证要求**: 需要（需要有效的 JWT token）
- **速率限制**: 每小时最多创建 20 个标签

### 请求头

```http
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```

### 请求体

```json
{
  "name": "技术",
  "slug": "tech",
  "color": "#FF5733"
}
```

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `name` | string | 是 | - | 标签名称，1-50 字符 |
| `slug` | string | 否 | 自动生成 | 标签 URL 标识，最多 100 字符 |
| `color` | string | 否 | null | 标签颜色，最多 20 字符 |

### 成功响应 (201 Created)

```json
{
  "success": true,
  "message": "标签创建成功",
  "data": {
    "id": "ec7ce332-8a6a-45de-87f9-57e78ac3f0da",
    "name": "技术",
    "slug": "tech",
    "color": "#FF5733",
    "postCount": 0,
    "createdAt": "2026-02-02T10:30:00.000Z",
    "updatedAt": "2026-02-02T10:30:00.000Z"
  }
}
```

### 错误响应

**400 Bad Request - 参数验证失败**

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "参数校验失败",
  "details": {
    "name": "标签名称不能为空"
  }
}
```

**401 Unauthorized - 未认证**

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "未提供有效的认证信息"
}
```

**429 Too Many Requests - 超过速率限制**

```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "请求过于频繁，请稍后再试"
}
```

---

## 2. 获取标签列表

获取标签列表，支持分页和搜索功能。

- **接口路径**: `/tags`
- **请求方法**: `GET`
- **认证要求**: 无（公开接口）

### 请求参数 (Query Parameters)

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `page` | number | 否 | 1 | 当前页码，必须 >= 1 |
| `pageSize` | number | 否 | 10 | 每页显示的标签数，1-100 |
| `search` | string | 否 | - | 搜索关键词，匹配标签名称或 slug |

### 请求示例

```http
GET /api/tags?page=1&pageSize=20&search=技术
```

### 成功响应 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "ec7ce332-8a6a-45de-87f9-57e78ac3f0da",
      "name": "技术",
      "slug": "tech",
      "color": "#FF5733",
      "postCount": 15,
      "createdAt": "2026-02-02T10:30:00.000Z",
      "updatedAt": "2026-02-02T10:30:00.000Z"
    },
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "前端开发",
      "slug": "frontend",
      "color": "#3498DB",
      "postCount": 8,
      "createdAt": "2026-02-01T15:20:00.000Z",
      "updatedAt": "2026-02-01T15:20:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `data` | Array | 标签列表 |
| `data[].id` | string | 标签唯一标识（UUID） |
| `data[].name` | string | 标签名称 |
| `data[].slug` | string | 标签 URL 标识 |
| `data[].color` | string \| null | 标签颜色 |
| `data[].postCount` | number | 关联的文章数量 |
| `data[].createdAt` | string | 创建时间（ISO 8601） |
| `data[].updatedAt` | string | 更新时间（ISO 8601） |
| `pagination` | Object | 分页信息 |
| `pagination.page` | number | 当前页码 |
| `pagination.pageSize` | number | 每页数量 |
| `pagination.total` | number | 总记录数 |
| `pagination.totalPages` | number | 总页数 |

---

## 3. 获取标签详情

根据标签 ID 获取单个标签的详细信息。

- **接口路径**: `/tags/:id`
- **请求方法**: `GET`
- **认证要求**: 无（公开接口）

### 路径参数

| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `id` | string | 是 | 标签 ID（UUID 格式） |

### 请求示例

```http
GET /api/tags/ec7ce332-8a6a-45de-87f9-57e78ac3f0da
```

### 成功响应 (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "ec7ce332-8a6a-45de-87f9-57e78ac3f0da",
    "name": "技术",
    "slug": "tech",
    "color": "#FF5733",
    "postCount": 15,
    "createdAt": "2026-02-02T10:30:00.000Z",
    "updatedAt": "2026-02-02T10:30:00.000Z"
  }
}
```

### 错误响应

**404 Not Found - 标签不存在**

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "标签不存在"
}
```

---

## 4. 更新标签

更新已存在标签的信息。

- **接口路径**: `/tags/:id`
- **请求方法**: `PUT`
- **认证要求**: 需要（需要有效的 JWT token）

### 请求头

```http
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```

### 路径参数

| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `id` | string | 是 | 标签 ID（UUID 格式） |

### 请求体

```json
{
  "name": "前端技术",
  "color": "#2ECC71"
}
```

### 请求参数

| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `name` | string | 否 | 新的标签名称，1-50 字符 |
| `slug` | string | 否 | 新的标签 URL 标识，最多 100 字符 |
| `color` | string | 否 | 新的标签颜色，最多 20 字符 |

**注意**: 至少需要提供一个参数。

### 成功响应 (200 OK)

```json
{
  "success": true,
  "message": "标签更新成功",
  "data": {
    "id": "ec7ce332-8a6a-45de-87f9-57e78ac3f0da",
    "name": "前端技术",
    "slug": "frontend-tech",
    "color": "#2ECC71",
    "postCount": 15,
    "createdAt": "2026-02-02T10:30:00.000Z",
    "updatedAt": "2026-02-02T11:00:00.000Z"
  }
}
```

### 错误响应

**400 Bad Request - 参数验证失败**

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "参数校验失败",
  "details": {
    "name": "标签名称最多50字符"
  }
}
```

**401 Unauthorized - 未认证**

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "未提供有效的认证信息"
}
```

**404 Not Found - 标签不存在**

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "标签不存在"
}
```

---

## 5. 删除标签

删除指定的标签。

- **接口路径**: `/tags/:id`
- **请求方法**: `DELETE`
- **认证要求**: 需要（需要有效的 JWT token）

### 请求头

```http
Authorization: Bearer <your_jwt_token>
```

### 路径参数

| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `id` | string | 是 | 标签 ID（UUID 格式） |

### 请求示例

```http
DELETE /api/tags/ec7ce332-8a6a-45de-87f9-57e78ac3f0da
```

### 成功响应 (200 OK)

```json
{
  "success": true,
  "message": "标签删除成功"
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

**403 Forbidden - 无法删除**

```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "无法删除：该标签下还有关联的文章"
}
```

**404 Not Found - 标签不存在**

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "标签不存在"
}
```

---

## 数据模型

### Tag 对象

```typescript
interface Tag {
  id: string;           // UUID 格式的唯一标识
  name: string;         // 标签名称
  slug: string;         // URL 友好的标识符
  color: string | null; // 标签颜色（十六进制格式）
  postCount: number;    // 关联的文章数量
  createdAt: string;    // 创建时间（ISO 8601）
  updatedAt: string;    // 更新时间（ISO 8601）
}
```

### CreateTagDTO

```typescript
interface CreateTagDTO {
  name: string;         // 必填，1-50 字符
  slug?: string;        // 可选，最多 100 字符
  color?: string;       // 可选，最多 20 字符
}
```

### UpdateTagDTO

```typescript
interface UpdateTagDTO {
  name?: string;        // 可选，1-50 字符
  slug?: string;        // 可选，最多 100 字符
  color?: string;       // 可选，最多 20 字符
}
```

---

## 注意事项

1. **标签 ID 格式**: 所有涉及标签 ID 的参数必须是有效的 UUID 格式（如 `ec7ce332-8a6a-45de-87f9-57e78ac3f0da`）

2. **Slug 自动生成**: 如果创建标签时未提供 `slug`，系统会根据 `name` 自动生成一个唯一的 slug

3. **删除限制**: 如果标签下有关联的文章，则无法删除该标签。需要先解除所有文章与该标签的关联

4. **缓存机制**: 标签列表和详情接口使用了 Redis 缓存，数据更新后会自动清除缓存

5. **速率限制**: 创建标签接口有速率限制，每小时最多创建 20 个标签

6. **认证要求**: 创建、更新和删除操作需要有效的 JWT token，查询操作无需认证

7. **分页参数**: 
   - `page` 必须是正整数
   - `pageSize` 范围为 1-100
   - 默认值为 `page=1`, `pageSize=10`

8. **搜索功能**: 搜索关键词会同时匹配标签名称和 slug 字段，不区分大小写

---

## 使用示例

### 创建标签

```bash
curl -X POST http://localhost:3000/api/tags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "技术",
    "color": "#FF5733"
  }'
```

### 获取标签列表

```bash
curl -X GET "http://localhost:3000/api/tags?page=1&pageSize=20&search=技术"
```

### 获取标签详情

```bash
curl -X GET http://localhost:3000/api/tags/ec7ce332-8a6a-45de-87f9-57e78ac3f0da
```

### 更新标签

```bash
curl -X PUT http://localhost:3000/api/tags/ec7ce332-8a6a-45de-87f9-57e78ac3f0da \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "前端技术",
    "color": "#2ECC71"
  }'
```

### 删除标签

```bash
curl -X DELETE http://localhost:3000/api/tags/ec7ce332-8a6a-45de-87f9-57e78ac3f0da \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 错误码说明

| 错误码 | HTTP 状态 | 描述 |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | 400 | 参数验证失败 |
| `UNAUTHORIZED` | 401 | 未提供有效的认证信息 |
| `FORBIDDEN` | 403 | 无权执行该操作 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超过速率限制 |
| `INTERNAL_SERVER_ERROR` | 500 | 服务器内部错误 |

---

## 更新日志

### v1.0.0 (2026-02-02)
- 初始版本发布
- 实现标签的 CRUD 操作
- 支持分页和搜索功能
- 添加速率限制和缓存机制
