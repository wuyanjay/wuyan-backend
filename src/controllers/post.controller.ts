import { Context } from 'koa';
import { z } from 'zod';
import { PostService } from '../services/post.service';
import { CreatePostDTO, UpdatePostDTO } from '../types/post.types';
import { PostStatus } from '@prisma/client';
import prisma from '../config/database';
import { NotFoundError, ForbiddenError } from '../errors/custom-errors';

const postService = new PostService();

// 验证 Schema
const createPostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200字符'),
  content: z.any(),  // Tiptap JSON
  excerpt: z.string().max(500).optional(),
  coverImage: z.string().url().optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string().uuid('标签ID格式不正确')).optional(),
  status: z.nativeEnum(PostStatus).optional()
});

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.any().optional(),
  excerpt: z.string().max(500).optional(),
  coverImage: z.string().url().optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string().uuid('标签ID格式不正确')).optional(),
  status: z.nativeEnum(PostStatus).optional()
});

export class PostController {
  /**
   * POST /api/posts
   * 创建文章
   */
  async createPost(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const body = createPostSchema.parse(ctx.request.body) as CreatePostDTO;

    const post = await postService.createPost(userId, body);

    ctx.status = 201;
    ctx.body = {
      success: true,
      message: '文章创建成功',
      data: post
    };
  }

  /**
   * PUT /api/posts/:id
   * 更新文章
   */
  async updatePost(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const userRole = ctx.state.user.roles?.[0] || 'USER';
    const postId = ctx.params.id;
    const body = updatePostSchema.parse(ctx.request.body) as UpdatePostDTO;

    const post = await postService.updatePost(postId, userId, userRole, body);

    ctx.body = {
      success: true,
      message: '文章更新成功',
      data: post
    };
  }

  /**
   * GET /api/posts
   * 获取文章列表
   */
  async getPostList(ctx: Context) {
    const query = {
      page: ctx.query.page ? parseInt(ctx.query.page as string) : 1,
      pageSize: ctx.query.pageSize ? parseInt(ctx.query.pageSize as string) : 10,
      status: ctx.query.status as PostStatus | undefined,
      categoryId: ctx.query.categoryId as string | undefined,
      tagId: ctx.query.tagId as string | undefined,
      authorId: ctx.query.authorId as string | undefined,
      search: ctx.query.search as string | undefined
    };

    const result = await postService.getPostList(query);

    ctx.body = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }

  /**
   * GET /api/posts/:id
   * 通过 ID 获取文章详情；若请求带有效登录态则写入该用户的浏览记录
   */
  async getPostById(ctx: Context) {
    const postId = ctx.params.id;
    const userId = ctx.state.user?.id ?? ctx.state.user?.sub;
    const userRole = ctx.state.user?.roles?.[0];

    const post = await postService.getPostById(postId, {
      incrementView: true,
      recordViewUserId: userId ?? undefined,
      currentUserId: userId ?? undefined,
      currentUserRole: userRole
    });

    ctx.body = {
      success: true,
      data: post
    };
  }

  /**
   * DELETE /api/posts/:id
   * 删除文章
   */
  async deletePost(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const userRole = ctx.state.user.roles?.[0] || 'USER';
    const postId = ctx.params.id;

    await postService.deletePost(postId, userId, userRole);

    ctx.body = {
      success: true,
      message: '文章删除成功'
    };
  }

  /**
   * GET /api/posts/:id/edit
   * 获取文章编辑数据（包含草稿）
   */
  async getPostForEdit(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const postId = ctx.params.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true } },
        category: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    if (post.author.id !== userId) {
      throw new ForbiddenError('无权编辑此文章');
    }

    ctx.body = {
      success: true,
      data: post
    };
  }

  /**
   * GET /api/posts/my
   * 获取当前用户的所有博客（支持分页和状态筛选）
   */
  async getMyPosts(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const query = {
      page: ctx.query.page ? parseInt(ctx.query.page as string) : 1,
      pageSize: ctx.query.pageSize ? parseInt(ctx.query.pageSize as string) : 10,
      status: ctx.query.status as PostStatus | undefined,
      search: ctx.query.search as string | undefined
    };

    const result = await postService.getMyPosts(userId, query);

    ctx.body = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }
}
