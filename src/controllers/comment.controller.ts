import { Context } from 'koa';
import { z } from 'zod';
import { CommentService } from '../services/comment.service';

const commentService = new CommentService();

const createCommentSchema = z.object({
  content: z.string().min(1, '评论内容不能为空'),
  postId: z.string().uuid(),
  parentId: z.string().uuid().optional()
});

export class CommentController {
  /**
   * POST /api/comments
   * 创建评论
   */
  async createComment(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const body = createCommentSchema.parse(ctx.request.body);

    const comment = await commentService.createComment(userId, body);

    ctx.status = 201;
    ctx.body = {
      success: true,
      message: '评论发表成功',
      data: comment
    };
  }

  /**
   * GET /api/comments/post/:postId
   * 获取文章评论
   */
  async getPostComments(ctx: Context) {
    const postId = ctx.params.postId;
    
    const comments = await commentService.getPostComments(postId);

    ctx.body = {
      success: true,
      data: comments
    };
  }

  /**
   * DELETE /api/comments/:id
   * 删除评论
   */
  async deleteComment(ctx: Context) {
    const userId = ctx.state.user.id || ctx.state.user.sub;
    const userRole = ctx.state.user.roles?.[0] || 'USER';
    const commentId = ctx.params.id;

    await commentService.deleteComment(commentId, userId, userRole);

    ctx.body = {
      success: true,
      message: '评论删除成功'
    };
  }
}
