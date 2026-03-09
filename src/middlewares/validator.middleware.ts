import { Context, Next } from 'koa';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../errors/custom-errors';

export const validate = (schema: ZodSchema) => {
  return async (ctx: Context, next: Next) => {
    try {
      const body = ctx.request.body || {};
      const query = ctx.query || {};
      const params = ctx.params || {};
      
      // 合并所有输入
      const data = { ...body, ...query, ...params };
      
      // 验证
      const validated = schema.parse(data);
      
      // 将验证后的数据放回request
      ctx.request.body = validated;
      
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.reduce((acc: any, err: any) => {
          const key = err.path.length > 0 ? err.path.join('.') : 'root';
          acc[key] = err.message;
          return acc;
        }, {});
        throw new ValidationError('参数校验失败', details);
      }
      throw error;
    }
  };
};
