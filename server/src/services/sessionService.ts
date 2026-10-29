import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { config } from '../config';
import { generateToken } from '../middleware/auth';
import {CookieOptions} from 'express';

export const SESSION_COOKIE = 'bonbook_session';
export function sessionCookieOptions():CookieOptions{return {httpOnly:true,secure:config.nodeEnv==='production',sameSite:config.nodeEnv==='production'?'none':'lax',...(config.nodeEnv==='production'?{partitioned:true}:{}),path:'/'};}
export function cookieValue(req: Request, name: string) {
  const value = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(name + '='));
  try { return value ? decodeURIComponent(value.slice(name.length + 1)) : null; } catch { return null; }
}
export function setSessionCookie(res: Response, token: string) {
  if(config.nodeEnv==='production')res.clearCookie(SESSION_COOKIE,{path:'/',httpOnly:true,secure:true,sameSite:'lax'});
  res.cookie(SESSION_COOKIE, token, {...sessionCookieOptions(),maxAge:86_400_000});
}
export function publicUser(user: User) {
  return { id: user.id, telegramId: user.telegramId, firstName: user.firstName, lastName: user.lastName,
    email: user.email, role: user.role || 'READER', telegramUsername: user.telegramUsername || null };
}
export function authenticationResponse(user: User, res: Response,existingToken?:string) {
  const token = existingToken||generateToken(user.id, user.telegramId);
  if(!existingToken)setSessionCookie(res, token);
  const missingFields = [!user.firstName && 'نام', !user.lastName && 'نام خانوادگی', !user.email && 'ایمیل'].filter(Boolean);
  return { token, user: publicUser(user), profileComplete: !missingFields.length, missingFields };
}
