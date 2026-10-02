import { Router } from 'express';
import { login, localTelegramStatus, localTelegramLogin } from '../controllers/authController';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.get('/local-telegram', localTelegramStatus);
router.post('/local-telegram', authLimiter, localTelegramLogin);

export default router;
