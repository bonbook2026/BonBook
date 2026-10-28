import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import bookRoutes from './books';
import orderRoutes from './orders';
import paymentRoutes from './payments';
import libraryRoutes from './library';
import adminRoutes from './admin';
import { readMedia,readPdfPageImage } from '../controllers/mediaController';
import {requireSection} from '../middleware/siteFeatures';
import {siteFeatures} from '../controllers/siteFeaturesController';
import {libraryHero} from '../controllers/libraryHeroController';

const router = Router();

router.use('/auth', authRoutes);
router.get('/site/sections',siteFeatures);
router.get('/site/library-hero',libraryHero);
router.use('/users', requireSection('profile'),userRoutes);
router.use('/books', requireSection('store'),bookRoutes);
router.use('/orders', requireSection('store'),orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/library', requireSection('library'),libraryRoutes);
router.use('/admin', adminRoutes);
router.get('/media/:id', requireSection('library'),readMedia);
router.get('/media/:id/pages/:page/image',requireSection('library'),readPdfPageImage);

export default router;
