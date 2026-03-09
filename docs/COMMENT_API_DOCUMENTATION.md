# 博客评论系统接口文档

## 基础信息
- **基础路径**: `/api/comments`
- **认证方式**: Bearer Token (JWT)

## 接口列表

### 1. 创建评论
发表一条新评论或回复现有评论。

- **URL**: `/`
- **Method**: `POST`
- **权限**: 需要登录
- **速率限制**: 每分钟最多 5 条评论

#### 请求参数 (Body)
| 参数名 | 类型 | 必选 | 说明 |
| :--- | :--- | :--- | :--- |
| content | string | 是 | 评论内容 (不能为空) |
| postId | string | 是 | 文章 ID (UUID) |
| parentId | string | 否 | 父评论 ID (UUID)，如果是回复评论则必填 |

#### 成功响应 (201 Created)
```json
{
  "success": true,
  "message": "评论发表成功",
  "data": {
    "id": "comment_uuid",
    "content": "这是一条评论内容",
    "likeCount": 0,
    "createdAt": "2023-10-27T10:00:00.000Z",
    "updatedAt": "2023-10-27T10:00:00.000Z",
    "author": {
      "id": "user_uuid",
      "username": "johndoe",
      "nickname": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "parent": null, // 如果是回复，这里会有父评论简要信息
    "replies": []
  }
}
```

#### 失败响应示例
- **400 Bad Request**: 参数验证失败
- **401 Unauthorized**: 未登录
- **404 Not Found**: 文章或父评论不存在
- **429 Too Many Requests**: 请求过于频繁

---

### 2. 获取文章评论列表
获取指定文章的所有评论，以树形结构返回（包含回复）。

- **URL**: `/post/:postId`
- **Method**: `GET`
- **权限**: 公开

#### 请求参数 (Path)
| 参数名 | 类型 | 必选 | 说明 |
| :--- | :--- | :--- | :--- |
| postId | string | 是 | 文章 ID (UUID) |

#### 成功响应 (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "comment_uuid_1",
      "content": "这是一条一级评论",
      "likeCount": 5,
      "createdAt": "2023-10-27T10:00:00.000Z",
      "updatedAt": "2023-10-27T10:00:00.000Z",
      "author": {
        "id": "user_uuid_1",
        "username": "user1",
        "nickname": "User One",
        "avatar": null
      },
      "replies": [
        {
          "id": "reply_uuid_1",
          "content": "这是一条回复",
          "likeCount": 2,
          "createdAt": "2023-10-27T10:05:00.000Z",
          "updatedAt": "2023-10-27T10:05:00.000Z",
          "author": {
            "id": "user_uuid_2",
            "username": "user2",
            "nickname": "User Two",
            "avatar": null
          },
          "parent": {
            "id": "comment_uuid_1",
            "author": {
              "username": "user1"
            }
          }
        }
      ]
    }
  ]
}
```

---

### 3. 删除评论
删除指定的评论。只有评论作者或管理员可以删除。删除评论会级联删除其所有回复。

- **URL**: `/:id`
- **Method**: `DELETE`
- **权限**: 需要登录 (作者或管理员)

#### 请求参数 (Path)
| 参数名 | 类型 | 必选 | 说明 |
| :--- | :--- | :--- | :--- |
| id | string | 是 | 评论 ID (UUID) |

#### 成功响应 (200 OK)
```json
{
  "success": true,
  "message": "评论删除成功"
}
```

#### 失败响应示例
- **401 Unauthorized**: 未登录
- **403 Forbidden**: 无权删除 (非作者且非管理员)
- **404 Not Found**: 评论不存在
