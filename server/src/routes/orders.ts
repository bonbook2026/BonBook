import { Router } from 'express';
import { createOrder, getExchangeRate, getOrder, getUserOrders } from '../controllers/orderController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, createOrder);
router.get('/', authMiddleware, getUserOrders);
router.get('/exchange-rate', authMiddleware, getExchangeRate);
router.get('/:id', authMiddleware, getOrder);

export default router;
