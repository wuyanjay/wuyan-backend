# Blog Like Functionality Documentation

## Overview

This document describes the blog like functionality implementation, which allows users to like/unlike blog posts with proper validation, authentication, and performance optimizations.

## Architecture

### Database Schema

#### PostLike Model
```prisma
model PostLike {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  postId    String   @map("post_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  @@unique([userId, postId])
  @@index([userId, createdAt(sort: Desc)])
  @@index([postId, createdAt(sort: Desc)])
  @@map("post_likes")
}
```

**Key Features:**
- **Unique Constraint**: Prevents duplicate likes (userId + postId)
- **Indexes**: Optimized for querying user's likes and post's likers
- **Cascade Delete**: Automatically cleans up likes when user or post is deleted

### Component Structure

```
src/
├── services/
│   └── like.service.ts          # Business logic for like operations
├── controllers/
│   └── like.controller.ts        # HTTP request handlers
├── routes/
│   └── like.routes.ts           # Route definitions
└── app.ts                        # Application setup (routes registered here)
```

## API Endpoints

### 1. Toggle Like (Like/Unlike)

**Endpoint:** `POST /api/posts/:id/like`

**Authentication:** Required

**Rate Limiting:** 30 requests per minute per user

**Request:**
```bash
POST /api/posts/550e8400-e29b-41d4-a716-446655440001/like
Authorization: Bearer <access_token>
```

**Response (Success - Like):**
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

**Response (Success - Unlike):**
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

**Error Responses:**
```json
// Post not found
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "文章不存在"
}

// Rate limit exceeded
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "请求过于频繁，请稍后再试"
}
```

### 2. Get Like Status

**Endpoint:** `GET /api/posts/:id/like/status`

**Authentication:** Optional (if authenticated, returns user's like status)

**Request:**
```bash
GET /api/posts/550e8400-e29b-41d4-a716-446655440001/like/status
Authorization: Bearer <access_token>  # Optional
```

**Response (Authenticated):**
```json
{
  "success": true,
  "data": {
    "isLiked": true,
    "likeCount": 42
  }
}
```

**Response (Unauthenticated):**
```json
{
  "success": true,
  "data": {
    "isLiked": false,
    "likeCount": 42
  }
}
```

### 3. Get Post Likers

**Endpoint:** `GET /api/posts/:id/likers`

**Authentication:** Not required

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 100

**Request:**
```bash
GET /api/posts/550e8400-e29b-41d4-a716-446655440001/likers?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "userId": "user-1",
      "username": "john_doe",
      "nickname": "John Doe",
      "avatar": "https://example.com/avatar.jpg",
      "likedAt": "2025-01-29T10:30:00.000Z"
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

### 4. Get User's Liked Posts

**Endpoint:** `GET /api/posts/liked`

**Authentication:** Required

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 100

**Request:**
```bash
GET /api/posts/liked?page=1&limit=20
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "post-1",
      "title": "My First Blog Post",
      "slug": "my-first-blog-post",
      "excerpt": "This is an excerpt...",
      "coverImage": "https://example.com/cover.jpg",
      "status": "PUBLISHED",
      "author": {
        "id": "author-1",
        "username": "jane_doe",
        "nickname": "Jane Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "category": {
        "id": "cat-1",
        "name": "Technology",
        "slug": "technology"
      },
      "tags": [
        {
          "id": "tag-1",
          "name": "JavaScript",
          "slug": "javascript",
          "color": "#f59e0b"
        }
      ],
      "viewCount": 150,
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

## Implementation Details

### Like Service (`like.service.ts`)

The `LikeService` class provides the following methods:

#### `togglePostLike(userId, postId)`
- **Purpose**: Toggle like status (like if not liked, unlike if liked)
- **Returns**: `{ isLiked: boolean, likeCount: number }`
- **Concurrency Handling**: Uses database unique constraint to prevent race conditions
- **Atomic Operations**: Like creation/deletion and count update are atomic

#### `likePost(userId, postId)`
- **Purpose**: Like a post
- **Returns**: `{ isLiked: true, likeCount: number }`
- **Validation**: Throws `ConflictError` if already liked

#### `unlikePost(userId, postId)`
- **Purpose**: Unlike a post
- **Returns**: `{ isLiked: false, likeCount: number }`
- **Validation**: Throws `ConflictError` if not liked

#### `getLikeStatus(userId, postId)`
- **Purpose**: Check if user has liked a post
- **Returns**: `{ isLiked: boolean, likeCount: number }`

#### `getPostLikers(postId, page, limit)`
- **Purpose**: Get paginated list of users who liked a post
- **Returns**: Paginated list with user details

#### `getUserLikedPosts(userId, page, limit)`
- **Purpose**: Get paginated list of posts liked by user
- **Returns**: Paginated list with post details

### Like Controller (`like.controller.ts`)

The `LikeController` handles HTTP requests and delegates to the service layer.

**Key Features:**
- Authentication middleware for protected endpoints
- Rate limiting for like operations
- Consistent response format
- Error handling with appropriate HTTP status codes

### Rate Limiting

Like operations are rate-limited to prevent abuse:
- **Window**: 60 seconds
- **Max Requests**: 30 per user
- **Key**: `like:{userId}`

## Security Considerations

### 1. Authentication
- All like operations require authentication
- User ID extracted from JWT token
- Optional authentication for status check (returns `isLiked: false` if not authenticated)

### 2. Authorization
- Users can only like/unlike posts (no additional authorization needed)
- Users can only view their own liked posts

### 3. Input Validation
- Post ID validated against database
- User ID from trusted JWT token
- Pagination parameters validated and sanitized

### 4. Rate Limiting
- Prevents spam likes
- Configurable limits per endpoint

### 5. SQL Injection Prevention
- Uses Prisma ORM with parameterized queries
- No raw SQL queries

## Performance Optimizations

### 1. Database Indexes
```prisma
@@unique([userId, postId])           // Prevents duplicates, enables fast lookup
@@index([userId, createdAt(sort: Desc)])  // Optimizes user's liked posts query
@@index([postId, createdAt(sort: Desc)])  // Optimizes post's likers query
```

### 2. Atomic Operations
- Like creation/deletion and count update happen in a transaction
- Prevents race conditions and ensures data consistency

### 3. Pagination
- All list endpoints support pagination
- Limits prevent excessive data retrieval
- Efficient database queries with `skip` and `take`

### 4. Selective Field Selection
- Only necessary fields are queried from database
- Reduces data transfer overhead

## Concurrency Handling

### Duplicate Like Prevention
The system prevents duplicate likes through:
1. **Database Unique Constraint**: `@@unique([userId, postId])`
2. **Service-Level Validation**: Checks for existing likes before creation

### Race Condition Prevention
- Uses Prisma's atomic operations (`increment`/`decrement`)
- Database-level constraints ensure consistency
- No race conditions in like count updates

### Example Scenario
```
User A and User B both like Post X simultaneously:

1. Both requests check for existing like (none found)
2. Both create PostLike records
3. Database unique constraint allows both (different users)
4. Both increment likeCount atomically
5. Final likeCount = 2 (correct)
```

## Error Handling

### Error Types

| Error Type | HTTP Status | Code | Description |
|------------|-------------|------|-------------|
| `NotFoundError` | 404 | NOT_FOUND | Post does not exist |
| `ConflictError` | 409 | CONFLICT | Already liked / not liked |
| `UnauthorizedError` | 401 | UNAUTHORIZED | Invalid or missing token |
| `RateLimitError` | 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| `InternalError` | 500 | INTERNAL_SERVER_ERROR | Server error |

### Error Response Format
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}  // Optional additional information
}
```

## Testing

### Manual Testing Examples

#### Test 1: Toggle Like
```bash
# Like a post
curl -X POST http://localhost:3000/api/posts/{post-id}/like \
  -H "Authorization: Bearer {token}"

# Unlike the same post
curl -X POST http://localhost:3000/api/posts/{post-id}/like \
  -H "Authorization: Bearer {token}"
```

#### Test 2: Get Like Status
```bash
# With authentication
curl http://localhost:3000/api/posts/{post-id}/like/status \
  -H "Authorization: Bearer {token}"

# Without authentication
curl http://localhost:3000/api/posts/{post-id}/like/status
```

#### Test 3: Get Post Likers
```bash
curl http://localhost:3000/api/posts/{post-id}/likers?page=1&limit=10
```

#### Test 4: Get User's Liked Posts
```bash
curl http://localhost:3000/api/posts/liked?page=1&limit=10 \
  -H "Authorization: Bearer {token}"
```

## Integration with Existing System

### Post Model Integration
The `Post` model already includes:
- `likeCount: Int @default(0)` - Counter for total likes
- `likes: PostLike[]` - Relation to like records

### User Model Integration
The `User` model already includes:
- `postLikes: PostLike[]` - Relation to user's likes

### Post Service Integration
The existing `PostService` can be extended to include like-related operations:
- Get posts with user's like status
- Sort posts by like count
- Filter posts by like criteria

## Future Enhancements

### Potential Features
1. **Like Notifications**: Notify authors when their posts are liked
2. **Like Analytics**: Track like trends and statistics
3. **Batch Operations**: Like/unlike multiple posts at once
4. **Like Exports**: Export user's liked posts
5. **Like Recommendations**: Recommend posts based on like patterns

### Performance Improvements
1. **Redis Caching**: Cache like counts for frequently accessed posts
2. **Materialized Views**: Pre-compute like statistics
3. **Background Jobs**: Process like notifications asynchronously
4. **Database Sharding**: Distribute like data across multiple databases

## Maintenance

### Database Migration
To apply the schema changes:
```bash
npx prisma migrate dev --name add_post_like_table
```

### Code Generation
To regenerate Prisma client:
```bash
npx prisma generate
```

### Monitoring
Monitor the following metrics:
- Like operation success rate
- Average response time for like operations
- Rate limit hit rate
- Database query performance

## Conclusion

The blog like functionality provides a robust, scalable, and user-friendly way for users to engage with blog posts. The implementation includes proper authentication, authorization, validation, rate limiting, and performance optimizations to ensure a smooth user experience while maintaining data integrity and system security.