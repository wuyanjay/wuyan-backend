import { Context } from 'koa';
import { z } from 'zod';
import { TagService } from '../services/tag.service';
import { CreateTagDTO, UpdateTagDTO, TagListQuery } from '../types/tag.types';

const tagService = new TagService();

const createTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(50, '标签名称最多50字符'),
  slug: z.string().max(100).optional(),
  color: z.string().max(20).optional()
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: z.string().max(100).optional(),
  color: z.string().max(20).optional()
});

const tagListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional()
});

export class TagController {
  async createTag(ctx: Context) {
    const body = createTagSchema.parse(ctx.request.body) as CreateTagDTO;

    const tag = await tagService.createTag(body);

    ctx.status = 201;
    ctx.body = {
      success: true,
      message: '标签创建成功',
      data: tag
    };
  }

  async getTagById(ctx: Context) {
    const tagId = ctx.params.id;

    const tag = await tagService.getTagById(tagId);

    ctx.body = {
      success: true,
      data: tag
    };
  }

  async getTagList(ctx: Context) {
    const query = tagListQuerySchema.parse(ctx.query) as TagListQuery;

    const result = await tagService.getTagList(query);

    ctx.body = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }

  async updateTag(ctx: Context) {
    const tagId = ctx.params.id;
    const body = updateTagSchema.parse(ctx.request.body) as UpdateTagDTO;

    const tag = await tagService.updateTag(tagId, body);

    ctx.body = {
      success: true,
      message: '标签更新成功',
      data: tag
    };
  }

  async deleteTag(ctx: Context) {
    const tagId = ctx.params.id;

    await tagService.deleteTag(tagId);

    ctx.body = {
      success: true,
      message: '标签删除成功'
    };
  }
}
