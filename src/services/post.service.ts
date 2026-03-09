import { Prisma, PostStatus } from '@prisma/client';
import prisma from '../config/database';
import redis from '../config/redis';
import { SlugUtil } from '../utils/slug.util';
import {
  CreatePostDTO,
  UpdatePostDTO,
  PostListQuery,
  PostResponse
} from '../types/post.types';
import {
  NotFoundError,
  ForbiddenError
} from '../errors/custom-errors';

/** 最近创建/最近浏览查询选项 */
export interface RecentPostsOptions {
  limit?: number;
  offset?: number;
  status?: PostStatus;
}

/** 最近创建文章单项（用于 stats 等） */
export interface RecentCreatedPostItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  status: PostStatus;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; slug: string; color: string | null }[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 最近浏览单项（用于 stats 等） */
export interface RecentViewedItem {
  viewedAt: Date;
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage: string | null;
    status: PostStatus;
    author: { id: string; username: string; nickname: string | null; avatar: string | null };
    category: { id: string; name: string; slug: string } | null;
    tags: { id: string; name: string; slug: string; color: string | null }[];
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: Date | null;
  };
}

export interface RecentCreatedResult {
  data: RecentCreatedPostItem[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

export interface RecentViewedResult {
  data: RecentViewedItem[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

export class PostService {
  /**
   * 创建文章
   */
  async createPost(userId: string, data: CreatePostDTO): Promise<PostResponse> {
    // 生成唯一 slug
    const slug = await SlugUtil.generateUnique(
      data.title,
      async (slug) => {
        const exists = await prisma.post.findUnique({ where: { slug } });
        return !!exists;
      }
    );

    // 如果发布，设置发布时间
    const publishedAt = data.status === PostStatus.PUBLISHED ? new Date() : null;

    // 处理标签
    const tagIds = data.tags ? await this.processTags(data.tags) : [];

    // 创建文章
    const post = await prisma.post.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        coverImage: data.coverImage,
        status: data.status || PostStatus.DRAFT,
        publishedAt,
        authorId: userId,
        categoryId: data.categoryId,
        // 创建标签关联
        tags: {
          create: tagIds.map(tagId => ({ tagId }))
        }
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true
              }
            }
          }
        }
      }
    });

    // 如果是发布状态，清除列表缓存
    if (data.status === PostStatus.PUBLISHED) {
      await this.clearListCache();
    }

    return this.formatPostResponse(post);
  }

  /**
   * 更新文章
   */
  async updatePost(
    postId: string,
    userId: string,
    userRole: string,
    data: UpdatePostDTO
  ): Promise<PostResponse> {
    // 查找文章
    const existingPost = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!existingPost) {
      throw new NotFoundError('文章不存在');
    }

    // 权限检查：只有作者或管理员可以编辑
    if (existingPost.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('无权编辑此文章');
    }

    // 如果修改了标题，重新生成 slug
    let slug = existingPost.slug;
    if (data.title && data.title !== existingPost.title) {
      slug = await SlugUtil.generateUnique(
        data.title,
        async (newSlug) => {
          if (newSlug === existingPost.slug) return false;
          const exists = await prisma.post.findUnique({ where: { slug: newSlug } });
          return !!exists;
        }
      );
    }

    // 如果从草稿变为发布，设置发布时间
    let publishedAt = existingPost.publishedAt;
    if (
      data.status === PostStatus.PUBLISHED &&
      existingPost.status !== PostStatus.PUBLISHED
    ) {
      publishedAt = new Date();
    }

    // 处理标签
    let tagIds: string[] | undefined;
    if (data.tags) {
      tagIds = await this.processTags(data.tags);
    }

    // 更新文章
    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        coverImage: data.coverImage,
        status: data.status,
        publishedAt,
        categoryId: data.categoryId,
        // 更新标签关联
        tags: tagIds ? {
          deleteMany: {},  // 先删除旧关联
          create: tagIds.map(tagId => ({ tagId }))
        } : undefined
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true
              }
            }
          }
        }
      }
    });

    // 清除缓存
    await this.clearPostCache(postId);
    await this.clearListCache();

    return this.formatPostResponse(post);
  }

  /**
   * 获取文章列表
   */
  async getPostList(query: PostListQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: Prisma.PostWhereInput = {
      // 默认只显示已发布文章（除非指定了 authorId 或 status）
      status: query.status || (query.authorId ? undefined : PostStatus.PUBLISHED),
      categoryId: query.categoryId,
      authorId: query.authorId,
      // 标签筛选
      tags: query.tagId ? {
        some: { tagId: query.tagId }
      } : undefined,
      // 搜索
      OR: query.search ? [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } }
      ] : undefined
    };

    // 尝试从缓存获取
    const cacheKey = this.getListCacheKey(query);
    const cached = await redis.get(cacheKey);
    if (cached && !query.authorId) {  // 用户专属列表不缓存
      return JSON.parse(cached);
    }

    // 查询数据库
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { publishedAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatar: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true
                }
              }
            }
          }
        }
      }),
      prisma.post.count({ where })
    ]);

    const result = {
      data: posts.map(post => this.formatPostResponse(post)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };

    // 缓存结果（5分钟）
    if (!query.authorId) {
      await redis.setex(cacheKey, 300, JSON.stringify(result));
    }

    return result;
  }

  /**
   * 获取文章详情（通过 ID）
   * @param incrementView 是否增加文章浏览量（默认 true）
   * @param recordViewUserId 若提供，则将该次浏览记入对应用户的最近浏览（需已登录）
   * @param currentUserId 当前请求用户ID（用于权限检查）
   * @param currentUserRole 当前请求用户角色（用于权限检查）
   */
  async getPostById(
    postId: string,
    options: { 
      incrementView?: boolean; 
      recordViewUserId?: string;
      currentUserId?: string;
      currentUserRole?: string;
    } = {}
  ): Promise<PostResponse> {
    const { incrementView = true, recordViewUserId, currentUserId, currentUserRole } = options;
    const cacheKey = `post:id:${postId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const post = JSON.parse(cached);
      
      // 检查权限：如果是草稿，只有作者或管理员可见
       if (post.status !== PostStatus.PUBLISHED) {
         // formatPostResponse 返回的结构中有 author 对象，但 authorId 可能不在顶层。
         // 查看 formatPostResponse: author 是对象。我们需要 post.author.id
         const authorId = post.author?.id;
         const canView = (currentUserId && authorId && currentUserId === authorId) || currentUserRole === 'ADMIN';
         
         if (!canView) {
            throw new NotFoundError('文章不存在');
         }
       }

      if (incrementView) {
        await this.incrementViewCount(post.id);
        post.viewCount += 1;
        await redis.setex(cacheKey, 600, JSON.stringify(post));
      }
      if (recordViewUserId) {
        this.recordPostView(recordViewUserId, post.id).catch(console.error);
      }
      return post;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
            bio: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true
              }
            }
          }
        }
      }
    });

    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    // 检查权限：如果是草稿，只有作者或管理员可见
    if (post.status !== PostStatus.PUBLISHED) {
      const isAuthor = currentUserId && currentUserId === post.authorId;
      const isAdmin = currentUserRole === 'ADMIN';
      
      if (!isAuthor && !isAdmin) {
        throw new NotFoundError('文章不存在');
      }
    }

    if (incrementView) {
      await this.incrementViewCount(post.id);
      post.viewCount += 1;
    }
    
    const formattedPost = this.formatPostResponse(post);
    
    // 只有已发布的文章才缓存，或者缓存策略需要调整。
    // 如果缓存了草稿，下次未登录用户访问会命中缓存。
    // 上面的缓存命中逻辑已经加了权限检查，所以缓存草稿是安全的，前提是 cached object 包含 author 信息。
    // formatPostResponse 包含 author 对象。
    
    await redis.setex(cacheKey, 600, JSON.stringify(formattedPost));

    if (recordViewUserId) {
      this.recordPostView(recordViewUserId, post.id).catch(console.error);
    }

    return formattedPost;
  }

  /**
   * 删除文章
   */
  async deletePost(postId: string, userId: string, userRole: string): Promise<void> {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    // 权限检查
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('无权删除此文章');
    }

    // 删除文章（级联删除评论和标签关联）
    await prisma.post.delete({ where: { id: postId } });

    // 清除缓存
    await this.clearPostCache(postId);
    await this.clearListCache();
  }

  /**
   * 增加浏览量（异步，不阻塞请求）
   */
  private async incrementViewCount(postId: string): Promise<void> {
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } }
    });
  }

  /**
   * 格式化文章响应
   */
  private formatPostResponse(post: any): PostResponse {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      status: post.status,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author,
      category: post.category,
      tags: post.tags?.map((pt: any) => pt.tag) || []
    };
  }

  /**
   * 清除文章缓存
   */
  private async clearPostCache(postId: string): Promise<void> {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (post) {
      await redis.del(`post:${postId}`);
      await redis.del(`post:id:${postId}`);
      await redis.del(`post:slug:${post.slug}`);
    }
  }

  /**
   * 清除列表缓存
   */
  private async clearListCache(): Promise<void> {
    const keys = await redis.keys('posts:list:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  /**
   * 处理标签（ID 或 名称）
   * 如果是 ID，检查是否存在
   * 如果是名称，查找或创建
   */
  private async processTags(tags: string[]): Promise<string[]> {
    const tagIds: string[] = [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const tagId of tags) {
      if (!tagId || typeof tagId !== 'string') continue;

      if (!uuidRegex.test(tagId)) {
        throw new Error(`标签ID格式不正确: ${tagId}`);
      }

      const tag = await prisma.tag.findUnique({ where: { id: tagId } });
      if (tag) {
        tagIds.push(tag.id);
      }
    }

    return [...new Set(tagIds)];
  }

  /**
   * 生成列表缓存键
   */
  private getListCacheKey(query: PostListQuery): string {
    const parts = ['posts', 'list', `page:${query.page || 1}`];
    if (query.categoryId) parts.push(`cat:${query.categoryId}`);
    if (query.tagId) parts.push(`tag:${query.tagId}`);
    if (query.search) parts.push(`search:${query.search}`);
    return parts.join(':');
  }

  /**
   * 获取用户最近创建的博客（供 stats 等复用）
   */
  async getRecentCreatedPosts(
    userId: string,
    options: RecentPostsOptions = {}
  ): Promise<RecentCreatedResult> {
    const { limit = 10, offset = 0, status } = options;
    const validLimit = Math.min(Math.max(1, limit), 50);
    const validOffset = Math.max(0, offset);

    const where: Prisma.PostWhereInput = { authorId: userId };
    if (status) {
      where.status = status;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          tags: {
            include: {
              tag: { select: { id: true, name: true, slug: true, color: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: validLimit,
        skip: validOffset
      }),
      prisma.post.count({ where })
    ]);

    const data: RecentCreatedPostItem[] = posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      coverImage: p.coverImage,
      status: p.status,
      categoryId: p.categoryId,
      category: p.category,
      tags: p.tags.map((pt) => pt.tag),
      viewCount: p.viewCount,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));

    return {
      data,
      pagination: {
        total,
        limit: validLimit,
        offset: validOffset,
        hasMore: validOffset + validLimit < total
      }
    };
  }

  /**
   * 获取当前用户的所有博客（支持分页和状态筛选）
   */
  async getMyPosts(
    userId: string,
    query: { page?: number; pageSize?: number; status?: PostStatus; search?: string }
  ) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PostWhereInput = {
      authorId: userId
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true
                }
              }
            }
          }
        }
      }),
      prisma.post.count({ where })
    ]);

    return {
      data: posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
        status: post.status,
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        category: post.category,
        tags: post.tags?.map((pt: any) => pt.tag) || []
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * 获取用户最近浏览的博客（供 stats 等复用）
   */
  async getRecentViewedPosts(
    userId: string,
    options: Omit<RecentPostsOptions, 'status'> = {}
  ): Promise<RecentViewedResult> {
    const { limit = 10, offset = 0 } = options;
    const validLimit = Math.min(Math.max(1, limit), 50);
    const validOffset = Math.max(0, offset);

    const [postViews, total] = await Promise.all([
      prisma.postView.findMany({
        where: { userId },
        include: {
          post: {
            include: {
              author: {
                select: { id: true, username: true, nickname: true, avatar: true }
              },
              category: { select: { id: true, name: true, slug: true } },
              tags: {
                include: {
                  tag: { select: { id: true, name: true, slug: true, color: true } }
                }
              }
            }
          }
        },
        orderBy: { viewedAt: 'desc' },
        take: validLimit,
        skip: validOffset
      }),
      prisma.postView.count({ where: { userId } })
    ]);

    const data: RecentViewedItem[] = postViews.map((v) => ({
      viewedAt: v.viewedAt,
      post: {
        id: v.post.id,
        title: v.post.title,
        slug: v.post.slug,
        excerpt: v.post.excerpt,
        coverImage: v.post.coverImage,
        status: v.post.status,
        author: v.post.author,
        category: v.post.category,
        tags: v.post.tags.map((pt) => pt.tag),
        viewCount: v.post.viewCount,
        likeCount: v.post.likeCount,
        commentCount: v.post.commentCount,
        publishedAt: v.post.publishedAt
      }
    }));

    return {
      data,
      pagination: {
        total,
        limit: validLimit,
        offset: validOffset,
        hasMore: validOffset + validLimit < total
      }
    };
  }

  /**
   * 记录文章浏览（upsert 更新 viewedAt，并异步增加文章 viewCount）
   */
  async recordPostView(userId: string, postId: string): Promise<void> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true }
    });
    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    await prisma.postView.upsert({
      where: {
        userId_postId: { userId, postId }
      },
      update: { viewedAt: new Date() },
      create: { userId, postId }
    });

    this.incrementViewCount(postId).catch((err) => {
      console.error('更新浏览计数失败:', err);
    });
  }
}
