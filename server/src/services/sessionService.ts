import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { config } from '../config';
import { generateToken } from '../middleware/auth';

export const SESSION_COOKIE = 'bonbook_session';
export function cookieValue(req: Request, name: string) {
  const value = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(name + '='));
  try { return value ? decodeURIComponent(value.slice(name.length + 1)) : null; } catch { return null; }
}
export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/', maxAge: 86_400_000 });
}
export function publicUser(user: User) {
  return { id: user.id, telegramId: user.telegramId, firstName: user.firstName, lastName: user.lastName,
    email: user.email, role: user.role || 'READER', telegramUsername: user.telegramUsername || null };
}
export function authenticationResponse(user: User, res: Response) {
  const token = generateToken(user.id, user.telegramId);
  setSessionCookie(res, token);
  const missingFields = [!user.firstName && 'نام', !user.lastName && 'نام خانوادگی', !user.email && 'ایمیل'].filter(Boolean);
  return { token, user: publicUser(user), profileComplete: !missingFields.length, missingFields };
}
