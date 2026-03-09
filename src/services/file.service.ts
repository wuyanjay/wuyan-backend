import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { UPLOAD_CONFIG } from '../config/upload.config';
import { env } from '../config/env';
import { ValidationError } from '../errors/custom-errors';

// 元数据接口
interface ImageMeta {
  url: string;
  filename: string;
  size: number;
  originalSize: number;
  mimeType: string;
  uploadedAt: string;
}

interface UploadMetaMap {
  [id: string]: ImageMeta;
}

// 元数据管理类
class UploadMeta {
  private filepath: string;
  private data: UploadMetaMap = {};

  constructor(filepath: string) {
    this.filepath = filepath;
    this.init();
  }

  // 初始化 - 读取现有数据
  async init() {
    try {
      const content = await fs.readFile(this.filepath, 'utf-8');
      this.data = JSON.parse(content);
    } catch {
      this.data = {};
      await this.save();
    }
  }

  // 保存到文件
  async save() {
    await fs.writeFile(this.filepath, JSON.stringify(this.data, null, 2));
  }

  // 添加新记录
  async add(id: string, meta: Omit<ImageMeta, 'uploadedAt'>) {
    this.data[id] = {
      ...meta,
      uploadedAt: new Date().toISOString(),
    };
    await this.save();
    return this.data[id];
  }

  // 获取单条记录
  get(id: string) {
    return this.data[id];
  }

  // 删除记录
  async delete(id: string) {
    delete this.data[id];
    await this.save();
  }

  // 列表查询 (分页)
  list(limit = 100, offset = 0) {
    const items = Object.entries(this.data)
      .map(([id, meta]) => ({ id, ...meta }))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  get stats() {
    return {
      totalImages: Object.keys(this.data).length
    };
  }
}

export class FileService {
  private meta: UploadMeta;

  constructor() {
    this.meta = new UploadMeta(UPLOAD_CONFIG.metaFile);
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    await fs.mkdir(UPLOAD_CONFIG.uploadDir, { recursive: true });
  }

  private getFullUrl(relativePath: string): string {
    const baseUrl = env.API_URL.replace(/\/$/, '');
    return `${baseUrl}${relativePath}`;
  }

  /**
   * 处理图片 (压缩优化)
   */
  private async processImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize({
        width: UPLOAD_CONFIG.maxWidth,
        height: UPLOAD_CONFIG.maxHeight,
        fit: 'inside',                // 保持宽高比
        withoutEnlargement: true,     // 不放大小图
      })
      .jpeg({
        quality: UPLOAD_CONFIG.quality,
        progressive: true,            // 渐进式加载
      })
      .toBuffer();
  }

  /**
   * 上传文件
   */
  async upload(file: any) {
    // 验证文件类型
    if (!UPLOAD_CONFIG.allowedTypes.includes(file.mimetype || file.type)) {
      throw new ValidationError('不支持的文件类型', {
        allowed: 'JPEG, PNG, WebP'
      });
    }

    // 临时文件路径 (koa-body saves to disk usually)
    const tempPath = file.filepath;
    
    try {
      // 读取原始文件
      const buffer = await fs.readFile(tempPath);
      
      // 处理图片
      const processed = await this.processImage(buffer);
      
      // 生成唯一ID和文件名
      const id = crypto.randomUUID();
      // 获取扩展名，默认为 .jpg 因为我们转换成了 jpeg
      const ext = '.jpg'; 
      const filename = `${id}${ext}`;
      const filepath = path.join(UPLOAD_CONFIG.uploadDir, filename);
      
      // 保存处理后的文件
      await fs.writeFile(filepath, processed);
      
      // 保存元数据
      const imageInfo = await this.meta.add(id, {
        url: `/uploads/${filename}`,
        filename: file.originalFilename || file.name,
        size: processed.length,
        originalSize: buffer.length,
        mimeType: file.mimetype || file.type,
      });
      
      return {
        id,
        ...imageInfo,
        url: this.getFullUrl(imageInfo.url)
      };
    } finally {
      // 清理临时文件
      if (tempPath) {
        await fs.unlink(tempPath).catch(() => {});
      }
    }
  }

  /**
   * 删除文件
   */
  async delete(id: string) {
    const info = this.meta.get(id);
    if (!info) {
      throw new ValidationError('图片不存在');
    }

    try {
      const filename = path.basename(info.url);
      const filepath = path.join(UPLOAD_CONFIG.uploadDir, filename);
      await fs.unlink(filepath);
    } catch (error) {
      // ignore file not found
    }

    await this.meta.delete(id);
  }

  /**
   * 获取文件信息
   */
  get(id: string) {
    const info = this.meta.get(id);
    if (info) {
      return {
        ...info,
        url: this.getFullUrl(info.url)
      };
    }
    return info;
  }

  /**
   * 获取列表
   */
  list(limit: number, offset: number) {
    const result = this.meta.list(limit, offset);
    return {
      ...result,
      items: result.items.map(item => ({
        ...item,
        url: this.getFullUrl(item.url)
      }))
    };
  }

  /**
   * 获取统计信息
   */
  get stats() {
    return this.meta.stats;
  }
}
