import Router from 'koa-router';
import { UploadController } from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = new Router({ prefix: '/api' });
const uploadController = new UploadController();

// 图片上传接口
// POST /api/upload
router.post('/upload', authMiddleware, (ctx) => uploadController.upload(ctx));

// 删除图片
// DELETE /api/upload/:id
router.delete('/upload/:id', authMiddleware, (ctx) => uploadController.delete(ctx));

// 获取图片信息 (JSON)
// GET /api/upload/:id
router.get('/upload/:id', (ctx) => uploadController.get(ctx));

// 图片列表查询
// GET /api/uploads
router.get('/uploads', authMiddleware, (ctx) => uploadController.list(ctx));

// 健康检查
// GET /api/upload-health
router.get('/upload-health', (ctx) => uploadController.health(ctx));

export default router;
