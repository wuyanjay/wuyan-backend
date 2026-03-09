import { Context } from 'koa';
import { FileService } from '../services/file.service';
import { NotFoundError } from '../errors/custom-errors';

const fileService = new FileService();

export class UploadController {
  /**
   * 上传图片
   * POST /upload
   */
  async upload(ctx: Context) {
    // @ts-ignore - koa-body files property
    const file = ctx.request.files?.file;
    
    if (!file) {
      ctx.status = 400;
      ctx.body = { success: false, error: 'No file uploaded' };
      return;
    }

    const result = await fileService.upload(file);
    
    ctx.body = {
      success: true,
      data: result
    };
  }

  /**
   * 删除图片
   * DELETE /upload/:id
   */
  async delete(ctx: Context) {
    const { id } = ctx.params;
    
    await fileService.delete(id);
    
    ctx.body = { success: true };
  }

  /**
   * 获取图片信息
   * GET /upload/:id
   */
  async get(ctx: Context) {
    const { id } = ctx.params;
    const info = fileService.get(id);
    
    if (!info) {
      throw new NotFoundError('Image not found');
    }

    ctx.body = {
      success: true,
      data: { id, ...info },
    };
  }

  /**
   * 列表查询
   * GET /uploads
   */
  async list(ctx: Context) {
    const limit = parseInt(ctx.query.limit as string) || 100;
    const offset = parseInt(ctx.query.offset as string) || 0;
    
    const result = fileService.list(limit, offset);
    
    ctx.body = {
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset
      }
    };
  }

  /**
   * 健康检查
   * GET /health-upload
   */
  async health(ctx: Context) {
    ctx.body = { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      stats: fileService.stats
    };
  }
}
