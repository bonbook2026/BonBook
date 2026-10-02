import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import bookRoutes from './books';
import orderRoutes from './orders';
import paymentRoutes from './payments';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/books', bookRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);

export default router;
