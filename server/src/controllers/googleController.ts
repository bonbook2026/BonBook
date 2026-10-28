import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma';
import { config } from '../config';
import { HttpError } from '../lib/httpError';
import { applyVerifiedAccess } from '../services/accessService';
import { authenticationResponse, cookieValue, SESSION_COOKIE, setSessionCookie } from '../services/sessionService';
import { generateToken } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

const stateCookie = 'bonbook_google_state';
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const googleEnabled = () => Boolean(config.google.clientId && config.google.clientSecret);
export const googleCallbackUrl = () => new URL('/api/auth/google/callback', config.frontendUrl).href;
const stateOptions = () => ({ httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax' as const, path: '/api/auth/google', maxAge: 600_000 });
const clearStateOptions = () => { const { maxAge, ...options } = stateOptions(); return options; };
const safeNext = (input: unknown) => typeof input === 'string' && /^\/(admin(?:\/.*)?|library|dashboard|profile|shop)$/.test(input) && !input.includes('\\') ? input : '/library';

export function loginOptions(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ google: googleEnabled(), telegramBotUrl: 'https://t.me/BonBook_bot' });
}

export async function googleStart(req: Request, res: Response, next: NextFunction) {
  try {
    if (!googleEnabled()) throw new HttpError(503, 'ورود با گوگل هنوز فعال نشده است. از تلگرام وارد شوید.');
    const state = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(48).toString('base64url');
    const nonce = crypto.randomBytes(32).toString('base64url');
    await prisma.oAuthAttempt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await prisma.oAuthAttempt.create({ data: { stateHash: hash(state), verifier, nonce,
      nextPath: safeNext(req.query.next), expiresAt: new Date(Date.now() + 600_000) } });
    res.cookie(stateCookie, state, stateOptions());
    const client = new OAuth2Client(config.google.clientId, config.google.clientSecret, googleCallbackUrl());
    res.redirect(client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, nonce,
      code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256' as any, prompt: 'select_account' }));
  } catch (error) { next(error); }
}

export async function googleCallback(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  const failure = new URL('/login', config.frontendUrl);
  failure.searchParams.set('error', 'google_failed');
  try {
    if (!googleEnabled() || typeof req.query.state !== 'string' || typeof req.query.code !== 'string') throw new Error('Invalid callback');
    const cookie = cookieValue(req, stateCookie);
    if (!cookie || cookie.length !== req.query.state.length || !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(req.query.state))) throw new Error('Invalid state');
    const attempt = await prisma.oAuthAttempt.findUnique({ where: { stateHash: hash(cookie) } });
    if (!attempt || attempt.usedAt || attempt.expiresAt < new Date()) throw new Error('Expired state');
    const used = await prisma.oAuthAttempt.updateMany({ where: { stateHash: attempt.stateHash, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new Error('State already used');
    const client = new OAuth2Client(config.google.clientId, config.google.clientSecret, googleCallbackUrl());
    const { tokens } = await client.getToken({ code: req.query.code, codeVerifier: attempt.verifier, redirect_uri: googleCallbackUrl() });
    if (!tokens.id_token) throw new Error('Missing ID token');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.google.clientId });
    const payload = ticket.getPayload() as (ReturnType<typeof ticket.getPayload> & { nonce?: string });
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true || payload.nonce !== attempt.nonce) throw new Error('Unverified identity');
    const identity = await prisma.authIdentity.findUnique({ where: { provider_subject: { provider: 'google', subject: payload.sub } }, include: { user: true } });
    let user = identity?.user;
    if (!user) {
      user = await prisma.user.create({ data: { telegramId: `google:${payload.sub}`, firstName: payload.given_name || payload.name || '',
        lastName: payload.family_name || '', email: payload.email.toLowerCase(),
        identities: { create: { provider: 'google', subject: payload.sub, verifiedEmail: payload.email.toLowerCase() } } } });
    } else {
      await prisma.authIdentity.update({ where: { id: identity!.id }, data: { verifiedEmail: payload.email.toLowerCase() } });
    }
    user = await applyVerifiedAccess(user.id, { googleEmail: payload.email });
    setSessionCookie(res, generateToken(user.id, user.telegramId));
    res.clearCookie(stateCookie, clearStateOptions());
    const destination = new URL('/auth/complete', config.frontendUrl);
    destination.searchParams.set('next', attempt.nextPath);
    res.redirect(destination.href);
  } catch {
    res.clearCookie(stateCookie, clearStateOptions());
    res.redirect(failure.href);
  }
}

export async function currentSession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new HttpError(401, 'دوباره وارد حساب شوید.');
    res.setHeader('Cache-Control', 'no-store');
    res.json(authenticationResponse(user, res));
  } catch (error) { next(error); }
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax' });
  res.json({ ok: true });
}
