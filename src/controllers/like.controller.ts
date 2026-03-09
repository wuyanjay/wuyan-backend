import { Context } from 'koa';
import { LikeService } from '../services/like.service';

const likeService = new LikeService();

export class LikeController {
  async toggleLike(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const postId = ctx.params.id;

    const result = await likeService.togglePostLike(userId, postId);

    ctx.body = {
      success: true,
      message: result.isLiked ? '点赞成功' : '取消点赞成功',
      data: result
    };
  }

  async likePost(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const postId = ctx.params.id;

    const result = await likeService.likePost(userId, postId);

    ctx.status = 201;
    ctx.body = {
      success: true,
      message: '点赞成功',
      data: result
    };
  }

  async unlikePost(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const postId = ctx.params.id;

    const result = await likeService.unlikePost(userId, postId);

    ctx.body = {
      success: true,
      message: '取消点赞成功',
      data: result
    };
  }

  async getLikeStatus(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const postId = ctx.params.id;

    const result = await likeService.getLikeStatus(userId, postId);

    ctx.body = {
      success: true,
      data: result
    };
  }

  async getPostLikers(ctx: Context) {
    const postId = ctx.params.id;
    const page = parseInt(ctx.query.page as string) || 1;
    const limit = Math.min(parseInt(ctx.query.limit as string) || 20, 100);

    const result = await likeService.getPostLikers(postId, page, limit);

    ctx.body = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }

  async getUserLikedPosts(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const page = parseInt(ctx.query.page as string) || 1;
    const limit = Math.min(parseInt(ctx.query.limit as string) || 20, 100);

    const result = await likeService.getUserLikedPosts(userId, page, limit);

    ctx.body = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }
}