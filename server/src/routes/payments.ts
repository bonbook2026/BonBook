import { Router } from 'express';
import { initiatePayment, paymentCallback, verifyPaymentManual } from '../controllers/paymentController';
import { authMiddleware } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/initiate', authMiddleware, paymentLimiter, initiatePayment);
router.get('/callback', paymentCallback); // No auth — BonCard redirects here
router.post('/verify', authMiddleware, paymentLimiter, verifyPaymentManual);

export default router;
