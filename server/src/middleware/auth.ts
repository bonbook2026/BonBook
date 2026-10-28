import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { isLocalTelegramRequest, LOCAL_TELEGRAM_ID } from '../services/localTelegramService';
import { cookieValue, SESSION_COOKIE } from '../services/sessionService';

export interface AuthRequest extends Request {
  userId?: number;
  telegramId?: string;
  adminRole?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieToken = cookieValue(req, SESSION_COOKIE);
  if (!authHeader?.startsWith('Bearer ') && !cookieToken) {
    res.status(401).json({ error: 'توکن احراز هویت ارسال نشده' });
    return;
  }

  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearer || cookieToken!;
  if (!bearer && !['GET', 'HEAD'].includes(req.method) && req.get('origin') !== new URL(config.frontendUrl).origin) {
    res.status(403).json({ error: 'مبدأ درخواست معتبر نیست.' }); return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      userId: number;
      telegramId: string;
      localTelegram?: boolean;
    };
    if (!Number.isSafeInteger(payload.userId) || typeof payload.telegramId !== 'string') throw new Error('Invalid session');
    if (payload.localTelegram && (!isLocalTelegramRequest(req) || payload.telegramId !== LOCAL_TELEGRAM_ID)) {
      throw new Error('Local Telegram sessions are only available in local development');
    }
    if (payload.telegramId === LOCAL_TELEGRAM_ID && payload.localTelegram !== true) {
      throw new Error('Local Telegram sessions require a development token');
    }
    req.userId = payload.userId;
    req.telegramId = payload.telegramId;
    next();
  } catch {
    res.status(401).json({ error: 'توکن نامعتبر است' });
  }
}

export function generateToken(userId: number, telegramId: string): string {
  return jwt.sign({ userId, telegramId }, config.jwtSecret, { expiresIn: '24h' });
}

export function generateLocalTelegramToken(userId: number): string {
  return jwt.sign(
    { userId, telegramId: LOCAL_TELEGRAM_ID, localTelegram: true },
    config.jwtSecret,
    { expiresIn: '8h' }
  );
}
