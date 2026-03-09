import prisma from '../config/database';
import redis from '../config/redis';
import { CreateCommentDTO, CommentResponse } from '../types/comment.types';
import { NotFoundError, ForbiddenError } from '../errors/custom-errors';

export class CommentService {
  /**
   * 创建评论
   */
  async createComment(userId: string, data: CreateCommentDTO): Promise<CommentResponse> {
    // 检查文章是否存在
    const post = await prisma.post.findUnique({
      where: { id: data.postId }
    });

    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    // 如果是回复，检查父评论是否存在
    if (data.parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: data.parentId }
      });

      if (!parentComment || parentComment.postId !== data.postId) {
        throw new NotFoundError('父评论不存在或不属于该文章');
      }
    }

    // 创建评论
    const comment = await prisma.comment.create({
      data: {
        content: data.content,
        postId: data.postId,
        authorId: userId,
        parentId: data.parentId
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
        parent: {
          select: {
            id: true,
            author: {
              select: { username: true }
            }
          }
        }
      }
    });

    // 更新文章评论数
    await prisma.post.update({
      where: { id: data.postId },
      data: { commentCount: { increment: 1 } }
    });

    // 清除文章缓存
    await this.clearPostCache(data.postId);

    return this.formatCommentResponse(comment);
  }

  /**
   * 获取文章的评论列表（树形结构）
   */
  async getPostComments(postId: string): Promise<CommentResponse[]> {
    // 只获取一级评论（parentId 为 null）
    const topLevelComments = await prisma.comment.findMany({
      where: {
        postId,
        parentId: null
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true
          }
        },
        // 包含所有回复（二级评论）
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true
              }
            },
            parent: {
              select: {
                id: true,
                author: {
                  select: { username: true }
                }
              }
            }
          }
        }
      }
    });

    return topLevelComments.map(comment => this.formatCommentResponse(comment));
  }

  /**
   * 删除评论
   */
  async deleteComment(commentId: string, userId: string, userRole: string): Promise<void> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        replies: { select: { id: true } }
      }
    });

    if (!comment) {
      throw new NotFoundError('评论不存在');
    }

    // 权限检查：只有作者或管理员可以删除
    if (comment.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('无权删除此评论');
    }

    // 计算要删除的评论数（包括回复）
    const deleteCount = 1 + comment.replies.length;

    // 删除评论（级联删除回复）
    await prisma.comment.delete({
      where: { id: commentId }
    });

    // 更新文章评论数
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: deleteCount } }
    });

    // 清除文章缓存
    await this.clearPostCache(comment.postId);
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
   * 格式化评论响应
   */
  private formatCommentResponse(comment: any): CommentResponse {
    return {
      id: comment.id,
      content: comment.content,
      likeCount: comment.likeCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author,
      parent: comment.parent,
      replies: comment.replies?.map((reply: any) => this.formatCommentResponse(reply)) || []
    };
  }
}
