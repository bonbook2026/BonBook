import { Router } from 'express';
import { login, localTelegramStatus, localTelegramLogin } from '../controllers/authController';
import { authLimiter } from '../middleware/rateLimiter';
import { loginOptions, googleStart, googleCallback, currentSession, logout } from '../controllers/googleController';
import { authMiddleware } from '../middleware/auth';
import {config} from '../config';

const router = Router();
router.use((req,res,next)=>{res.setHeader('Cache-Control','private, no-store');if(req.path!=='/local-telegram'&&!['GET','HEAD'].includes(req.method)&&req.get('origin')&&req.get('origin')!==new URL(config.frontendUrl).origin){res.status(403).json({error:'مبدأ درخواست ورود معتبر نیست.'});return;}next();});

router.post('/login', authLimiter, login);
router.get('/local-telegram', localTelegramStatus);
router.post('/local-telegram', authLimiter, localTelegramLogin);
router.get('/options', loginOptions);
router.get('/google/start', authLimiter, googleStart);
router.get('/google/callback', authLimiter, googleCallback);
router.get('/session', authMiddleware, currentSession);
router.post('/logout', logout);

export default router;
