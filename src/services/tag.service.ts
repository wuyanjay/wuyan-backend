import prisma from '../config/database';
import redis from '../config/redis';
import { SlugUtil } from '../utils/slug.util';
import {
  CreateTagDTO,
  UpdateTagDTO,
  TagListQuery,
  TagResponse,
  TagListResponse
} from '../types/tag.types';
import { NotFoundError, ForbiddenError } from '../errors/custom-errors';

export class TagService {
  async createTag(data: CreateTagDTO): Promise<TagResponse> {
    const slug = data.slug || await SlugUtil.generateUnique(
      data.name,
      async (s) => {
        const exists = await prisma.tag.findUnique({ where: { slug: s } });
        return !!exists;
      }
    );

    const tag = await prisma.tag.create({
      data: {
        name: data.name,
        slug,
        color: data.color
      }
    });

    await this.clearTagListCache();

    return this.formatTagResponse(tag);
  }

  async getTagById(tagId: string): Promise<TagResponse> {
    const cacheKey = `tag:id:${tagId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    });

    if (!tag) {
      throw new NotFoundError('标签不存在');
    }

    const response = this.formatTagResponse(tag);
    await redis.setex(cacheKey, 600, JSON.stringify(response));

    return response;
  }

  async getTagList(query: TagListQuery): Promise<TagListResponse> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const cacheKey = this.getTagListCacheKey(query);
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const [tags, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { posts: true }
          }
        }
      }),
      prisma.tag.count({ where })
    ]);

    const result: TagListResponse = {
      data: tags.map(tag => this.formatTagResponse(tag)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };

    await redis.setex(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  async updateTag(tagId: string, data: UpdateTagDTO): Promise<TagResponse> {
    const existingTag = await prisma.tag.findUnique({
      where: { id: tagId }
    });

    if (!existingTag) {
      throw new NotFoundError('标签不存在');
    }

    let slug = existingTag.slug;
    if (data.name && data.name !== existingTag.name) {
      slug = await SlugUtil.generateUnique(
        data.name,
        async (newSlug) => {
          if (newSlug === existingTag.slug) return false;
          const exists = await prisma.tag.findUnique({ where: { slug: newSlug } });
          return !!exists;
        }
      );
    }

    const tag = await prisma.tag.update({
      where: { id: tagId },
      data: {
        name: data.name,
        slug,
        color: data.color
      },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    });

    await this.clearTagCache(tagId);
    await this.clearTagListCache();

    return this.formatTagResponse(tag);
  }

  async deleteTag(tagId: string): Promise<void> {
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    });

    if (!tag) {
      throw new NotFoundError('标签不存在');
    }

    if (tag._count.posts > 0) {
      throw new ForbiddenError('无法删除：该标签下还有关联的文章');
    }

    await prisma.tag.delete({ where: { id: tagId } });

    await this.clearTagCache(tagId);
    await this.clearTagListCache();
  }

  private formatTagResponse(tag: any): TagResponse {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      postCount: tag._count?.posts || 0,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt
    };
  }

  private async clearTagCache(tagId: string): Promise<void> {
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (tag) {
      await redis.del(`tag:${tagId}`);
      await redis.del(`tag:id:${tagId}`);
      await redis.del(`tag:slug:${tag.slug}`);
    }
  }

  private async clearTagListCache(): Promise<void> {
    const keys = await redis.keys('tags:list:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  private getTagListCacheKey(query: TagListQuery): string {
    const parts = ['tags', 'list', `page:${query.page || 1}`];
    if (query.search) parts.push(`search:${query.search}`);
    return parts.join(':');
  }
}
