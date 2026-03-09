# API 接口文档

本文档描述了新增的分类、标签和分页数据接口。

**基础 URL**: `http://localhost:3000/api` (开发环境)

**通用响应结构**:
所有接口均返回统一的 JSON 格式：

```json
{
  "success": true,        // 请求是否成功
  "status": 200,          // HTTP 状态码或业务状态码
  "message": "描述信息",   // 成功或错误提示
  "data": { ... }         // 实际业务数据，失败时为 null
}
```

---

## 1. 获取所有分类 (Categories)

获取系统中所有可用的文章/条目分类。

- **接口路径**: `/categories`
- **请求方法**: `GET`
- **认证要求**: 无（公开接口）

### 成功响应 (200 OK)

```json
{
  "success": true,
  "status": 200,
  "message": "获取分类列表成功",
  "data": [
    {
      "id": "d4fa96a7-2756-45ec-a5fc-4f8598803724",
      "name": "科技",
      "slug": "cat-l1r3cl-1769516404429",
      "description": "科技 related content",
      "icon": null
    },
    // ... 更多分类
  ]
}
```

---

## 2. 获取所有标签 (Tags)

获取系统中所有可用的标签。

- **接口路径**: `/tags`
- **请求方法**: `GET`
- **认证要求**: 无（公开接口）

### 成功响应 (200 OK)

```json
{
  "success": true,
  "status": 200,
  "message": "获取标签列表成功",
  "data": [
    {
      "id": "0e03b396-d1ae-48d9-b9cf-9ecf182c711f",
      "name": "前端",
      "slug": "tag-2k9j8h-1769516404435",
      "color": "#a1b2c3"
    },
    // ... 更多标签
  ]
}
```

---

## 3. 分页获取数据 (Items)

获取带有分页功能的条目数据列表。

- **接口路径**: `/items`
- **请求方法**: `GET`
- **认证要求**: 无（公开接口）

### 请求参数 (Query Parameters)

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `page` | number | 否 | 1 | 当前页码，必须 >= 1 |
| `limit` | number | 否 | 10 | 每页显示的条目数，必须 >= 1 |

### 成功响应 (200 OK)

```json
{
  "success": true,
  "status": 200,
  "message": "获取分页数据成功",
  "data": {
    "items": [
      {
        "id": "c0a23089-e0aa-4b79-bc47-3e9e53492110",
        "title": "测试条目 50 - 时尚",
        "content": "内容摘要...",
        "category_id": "51ecc6d6-8ae0-42c5-966e-6380b3b860a8",
        "tag_ids": ["0e03b396..."],
        "category": { "id": "...", "name": "时尚" },
        "tags": [{ "id": "...", "name": "前端" }],
        "createdAt": "2026-01-27T12:20:04.583Z"
      }
    ],
    "totalItems": 50,
    "totalPages": 5,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

### 响应字段说明 (`data` 对象)

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `items` | Array | 当前页的数据列表 |
| `totalItems` | number | 数据库中满足条件的总条目数 |
| `totalPages` | number | 总页数 |
| `currentPage` | number | 当前页码 |
| `itemsPerPage` | number | 每页条目数 |

---

## 错误处理

如果发生服务器内部错误，接口将返回如下格式：

```json
{
  "success": false,
  "status": 500,
  "message": "Internal Server Error: 具体的错误信息",
  "data": null
}
```
