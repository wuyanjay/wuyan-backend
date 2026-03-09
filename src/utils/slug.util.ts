import crypto from 'crypto';

export class SlugUtil {
  /**
   * 生成 URL 友好的 slug
   * @param text 原始文本
   * @returns slug
   */
  static generate(text: string): string {
    // 转小写，替换空格为连字符
    let slug = text
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')     // 空格和下划线替换为 -
      .replace(/[^\w\-]+/g, '')    // 移除非字母数字字符
      .replace(/\-\-+/g, '-')      // 多个连字符替换为单个
      .replace(/^-+/, '')          // 移除开头的 -
      .replace(/-+$/, '');         // 移除结尾的 -

    // 如果 slug 为空或太短，添加随机后缀
    if (slug.length < 3) {
      slug = `post-${crypto.randomBytes(4).toString('hex')}`;
    }

    return slug;
  }

  /**
   * 生成唯一 slug（检查数据库）
   */
  static async generateUnique(
    title: string,
    checkExists: (slug: string) => Promise<boolean>
  ): Promise<string> {
    let slug = this.generate(title);
    let counter = 1;

    // 如果 slug 已存在，添加数字后缀
    while (await checkExists(slug)) {
      slug = `${this.generate(title)}-${counter}`;
      counter++;
    }

    return slug;
  }
}
