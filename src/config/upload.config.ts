import path from 'path';

export const UPLOAD_CONFIG = {
  uploadDir: path.join(process.cwd(), 'uploads'),
  metaFile: path.join(process.cwd(), 'uploads.json'),
  maxFileSize: 5 * 1024 * 1024,    // 5MB
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 85,
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
};
