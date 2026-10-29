import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {LOCAL_TELEGRAM_ID} from '../services/localTelegramService';
import { config } from '../config';
import { cookieValue, SESSION_COOKIE } from '../services/sessionService';
import crypto from 'crypto';
import {contentIdentity} from '../services/contentProtection';

export interface AuthRequest extends Request {
  userId?: number;
  telegramId?: string;
  adminRole?: string;
  sessionToken?:string;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
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
    const identity=await contentIdentity(req);
    req.userId = identity.userId;
    req.sessionToken=identity.token;
    req.telegramId = (jwt.decode(token) as {telegramId:string}).telegramId;
    next();
  } catch {
    res.status(401).json({ error: 'توکن نامعتبر است' });
  }
}

export function generateToken(userId: number, telegramId: string): string {
  return jwt.sign({ userId, telegramId }, config.jwtSecret, { expiresIn: '24h',jwtid:crypto.randomUUID() });
}

export function generateLocalTelegramToken(userId: number): string {
  return jwt.sign(
    { userId, telegramId: LOCAL_TELEGRAM_ID, localTelegram: true },
    config.jwtSecret,
    { expiresIn: '8h' }
  );
}
