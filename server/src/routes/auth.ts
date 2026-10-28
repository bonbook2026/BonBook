import { Router } from 'express';
import { login, localTelegramStatus, localTelegramLogin } from '../controllers/authController';
import { authLimiter } from '../middleware/rateLimiter';
import { loginOptions, googleStart, googleCallback, currentSession, logout } from '../controllers/googleController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/login', authLimiter, login);
router.get('/local-telegram', localTelegramStatus);
router.post('/local-telegram', authLimiter, localTelegramLogin);
router.get('/options', loginOptions);
router.get('/google/start', authLimiter, googleStart);
router.get('/google/callback', authLimiter, googleCallback);
router.get('/session', authMiddleware, currentSession);
router.post('/logout', logout);

export default router;
