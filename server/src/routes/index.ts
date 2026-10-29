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
import {libraryHeroAudio} from '../controllers/libraryHeroController';
import {privateContentHeaders,requireContentAccount} from '../middleware/contentSecurity';

const router = Router();

router.use('/auth', authRoutes);
router.get('/site/sections',siteFeatures);
router.get('/site/library-hero',libraryHero);
router.get('/site/library-hero/audio',privateContentHeaders,requireSection('library'),requireContentAccount,libraryHeroAudio);
router.use('/users', requireSection('profile'),userRoutes);
router.use('/books', requireSection('store'),bookRoutes);
router.use('/orders', requireSection('store'),orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/library', requireSection('library'),libraryRoutes);
router.use('/admin', adminRoutes);
router.get('/media/:id',privateContentHeaders,requireSection('library'),readMedia);
router.get('/media/:id/pages/:page/image',privateContentHeaders,requireSection('library'),readPdfPageImage);

export default router;
