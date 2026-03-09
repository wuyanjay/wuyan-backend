import Router from 'koa-router';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/role.middleware';

const router = new Router({ prefix: '/api/users' });
const userController = new UserController();

// 所有接口都需要认证
router.use(authMiddleware);

// 管理员专用接口
router.post('/', adminMiddleware, (ctx) => userController.createUser(ctx));
router.get('/', adminMiddleware, (ctx) => userController.getUsers(ctx));
router.delete('/:id', adminMiddleware, (ctx) => userController.deleteUser(ctx));

// 个人或管理员接口
router.get('/:id', (ctx) => userController.getUserById(ctx));
router.patch('/:id', (ctx) => userController.updateUser(ctx));
// 兼容 PUT
router.put('/:id', (ctx) => userController.updateUser(ctx));

export default router;
