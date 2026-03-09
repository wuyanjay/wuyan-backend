import prisma from '../config/database';
import { NotFoundError, ConflictError } from '../errors/custom-errors';
import { logger } from '../utils/logger';

export interface LikeStatus {
  isLiked: boolean;
  likeCount: number;
}

export class LikeService {
  async togglePostLike(userId: string, postId: string): Promise<LikeStatus> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, likeCount: true }
    });

    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        userId_postId: { userId, postId }
      }
    });

    if (existingLike) {
      await prisma.postLike.delete({
        where: { id: existingLike.id }
      });

      const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true }
      });

      logger.info('Post unliked', { userId, postId, likeCount: updatedPost.likeCount });

      return {
        isLiked: false,
        likeCount: updatedPost.likeCount
      };
    } else {
      await prisma.postLike.create({
        data: { userId, postId }
      });

      const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true }
      });

      logger.info('Post liked', { userId, postId, likeCount: updatedPost.likeCount });

      return {
        isLiked: true,
        likeCount: updatedPost.likeCount
      };
    }
  }

  async likePost(userId: string, postId: string): Promise<LikeStatus> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, likeCount: true }
    });

    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        userId_postId: { userId, postId }
      }
    });

    if (existingLike) {
      throw new ConflictError('已经点赞过该文章');
    }

    await prisma.postLike.create({
      data: { userId, postId }
    });

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true }
    });

    logger.info('Post liked', { userId, postId, likeCount: updatedPost.likeCount });

    return {
      isLiked: true,
      likeCount: updatedPost.likeCount
    };
  }

  async unlikePost(userId: string, postId: string): Promise<LikeStatus> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, likeCount: true }
    });

    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        userId_postId: { userId, postId }
      }
    });

    if (!existingLike) {
      throw new ConflictError('未点赞过该文章');
    }

    await prisma.postLike.delete({
      where: { id: existingLike.id }
    });

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true }
    });

    logger.info('Post unliked', { userId, postId, likeCount: updatedPost.likeCount });

    return {
      isLiked: false,
      likeCount: updatedPost.likeCount
    };
  }

  async getLikeStatus(userId: string, postId: string): Promise<LikeStatus> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, likeCount: true }
    });

    if (!post) {
      throw new NotFoundError('文章不存在');
    }

    const like = await prisma.postLike.findUnique({
      where: {
        userId_postId: { userId, postId }
      }
    });

    return {
      isLiked: !!like,
      likeCount: post.likeCount
    };
  }

  async getPostLikers(postId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [likes, total] = await Promise.all([
      prisma.postLike.findMany({
        where: { postId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.postLike.count({ where: { postId } })
    ]);

    return {
      data: likes.map(like => ({
        userId: like.user.id,
        username: like.user.username,
        nickname: like.user.nickname,
        avatar: like.user.avatar,
        likedAt: like.createdAt
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getUserLikedPosts(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [likes, total] = await Promise.all([
      prisma.postLike.findMany({
        where: { userId },
        include: {
          post: {
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
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.postLike.count({ where: { userId } })
    ]);

    return {
      data: likes.map(like => ({
        id: like.post.id,
        title: like.post.title,
        slug: like.post.slug,
        excerpt: like.post.excerpt,
        coverImage: like.post.coverImage,
        status: like.post.status,
        author: like.post.author,
        category: like.post.category,
        tags: like.post.tags.map(pt => pt.tag),
        viewCount: like.post.viewCount,
        likeCount: like.post.likeCount,
        commentCount: like.post.commentCount,
        publishedAt: like.post.publishedAt,
        likedAt: like.createdAt
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}