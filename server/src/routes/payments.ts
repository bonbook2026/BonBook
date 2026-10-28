import { Router } from 'express';
import { initiatePayment, paymentCallback, verifyPaymentManual } from '../controllers/paymentController';
import { authMiddleware } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimiter';
import {requireSection} from '../middleware/siteFeatures';

const router = Router();

router.post('/initiate', requireSection('store'),authMiddleware, paymentLimiter, initiatePayment);
router.get('/callback', paymentCallback); // No auth — BonCard redirects here
router.post('/verify', authMiddleware, paymentLimiter, verifyPaymentManual);

export default router;
