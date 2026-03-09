import Router from 'koa-router';
import { ItemController } from '../controllers/item.controller';

const router = new Router({ prefix: '/api' });

// Categories
router.get('/categories', ItemController.getCategories);

// Tags
router.get('/tags', ItemController.getTags);

// Items (Pagination)
router.get('/items', ItemController.getItems);

export default router;
