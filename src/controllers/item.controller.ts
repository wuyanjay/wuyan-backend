import { Context } from 'koa';
import prisma from '../config/database';

export class ItemController {
  
  static async getCategories(ctx: Context) {
    try {
      const categories = await prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          icon: true
        }
      });
      ctx.body = {
        success: true,
        status: 200,
        message: '获取分类列表成功',
        data: categories
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      ctx.status = 500;
      ctx.body = { 
        success: false,
        status: 500,
        message: error instanceof Error ? error.message : String(error),
        data: null
      };
    }
  }

  static async getTags(ctx: Context) {
    try {
      const tags = await prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          color: true
        }
      });
      ctx.body = {
        success: true,
        status: 200,
        message: '获取标签列表成功',
        data: tags
      };
    } catch (error) {
      console.error('Error fetching tags:', error);
      ctx.status = 500;
      ctx.body = { 
        success: false,
        status: 500,
        message: error instanceof Error ? error.message : String(error),
        data: null
      };
    }
  }

  static async getItems(ctx: Context) {
    try {
      const page = Math.max(1, parseInt(ctx.query.page as string) || 1);
      const limit = Math.max(1, parseInt(ctx.query.limit as string) || 10);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        prisma.item.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            category: {
              select: { id: true, name: true }
            },
            tags: {
              select: { id: true, name: true }
            }
          }
        }),
        prisma.item.count()
      ]);

      const totalPages = Math.ceil(total / limit);

      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category_id: item.categoryId,
        tag_ids: item.tags.map(t => t.id),
        // Additional useful info
        category: item.category,
        tags: item.tags,
        createdAt: item.createdAt
      }));

      ctx.body = {
        success: true,
        status: 200,
        message: '获取分页数据成功',
        data: {
          items: formattedItems,
          totalItems: total,
          totalPages: totalPages,
          currentPage: page,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      console.error('Error fetching items:', error);
      ctx.status = 500;
      ctx.body = { 
        success: false,
        status: 500,
        message: error instanceof Error ? error.message : String(error),
        data: null
      };
    }
  }
}
