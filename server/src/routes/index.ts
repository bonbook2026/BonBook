import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import bookRoutes from './books';
import orderRoutes from './orders';
import paymentRoutes from './payments';
import libraryRoutes from './library';
import adminRoutes from './admin';
import { readMedia,readPdfPageImage } from '../controllers/mediaController';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/books', bookRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/library', libraryRoutes);
router.use('/admin', adminRoutes);
router.get('/media/:id', readMedia);
router.get('/media/:id/pages/:page/image',readPdfPageImage);

export default router;
