import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { Request } from 'express';
import { Server, request as httpRequest } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import authRoutes from '../src/routes/auth';
import { AuthRequest, authMiddleware, generateLocalTelegramToken, generateToken } from '../src/middleware/auth';
import { isLocalTelegramRequest, LOCAL_TELEGRAM_ID } from '../src/services/localTelegramService';
import { UserService } from '../src/services/userService';

const originalConfig = {
  nodeEnv: config.nodeEnv,
  localTelegramLogin: config.localTelegramLogin,
  jwtSecret: config.jwtSecret,
};

const localUser = {
  id: 42,
  telegramId: LOCAL_TELEGRAM_ID,
  firstName: 'کاربر',
  lastName: 'آزمایشی',
  email: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('Local Telegram login', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    app.get('/protected', authMiddleware, (req: AuthRequest, res) => {
      res.json({ userId: req.userId, telegramId: req.telegramId });
    });
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a local test server');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  beforeEach(() => {
    config.nodeEnv = 'development';
    config.localTelegramLogin = true;
    config.jwtSecret = 'local-telegram-test-secret';
    vi.spyOn(UserService.prototype, 'findOrCreate').mockResolvedValue(localUser);
  });

  afterEach(() => {
    Object.assign(config, originalConfig);
    vi.restoreAllMocks();
  });

  function sendRequest(path: string, method: string, headers: Record<string, string>) {
    // Node's fetch can replace Host, so use HTTP directly to exercise that guard.
    return new Promise<Response>((resolve, reject) => {
      const request = httpRequest(`${baseUrl}${path}`, { method, headers }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          resolve(new Response(Buffer.concat(chunks).toString(), { status: response.statusCode }));
        });
      });
      request.on('error', reject);
      request.end();
    });
  }

  function login(headers: Record<string, string> = {}) {
    return sendRequest('/auth/local-telegram', 'POST', headers);
  }

  function protectedRequest(token: string, headers: Record<string, string> = {}) {
    return sendRequest('/protected', 'GET', { Authorization: `Bearer ${token}`, ...headers });
  }

  it('logs into a reserved account and issues a usable marked session', async () => {
    const status = await fetch(`${baseUrl}/auth/local-telegram`);
    expect(await status.json()).toEqual({ enabled: true });

    const response = await fetch(`${baseUrl}/auth/local-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ telegramId: '123456', userId: 999 }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const result = await response.json();
    expect(result.user.telegramId).toBe(LOCAL_TELEGRAM_ID);
    expect(result.profileComplete).toBe(false);
    expect(result.missingFields).toEqual(['ایمیل']);
    expect(UserService.prototype.findOrCreate).toHaveBeenCalledWith(LOCAL_TELEGRAM_ID, 'کاربر', 'آزمایشی');
    expect(jwt.verify(result.token, config.jwtSecret)).toMatchObject({
      userId: 42, telegramId: LOCAL_TELEGRAM_ID, localTelegram: true,
    });
    const profile = await protectedRequest(result.token);
    expect(profile.status).toBe(200);
    expect(await profile.json()).toEqual({ userId: 42, telegramId: LOCAL_TELEGRAM_ID });
    expect((await (await login()).json()).user.id).toBe(42);
  });

  it.each(['production', 'test'])('rejects simulated login and sessions in %s', async (mode) => {
    const token = generateLocalTelegramToken(42);
    config.nodeEnv = mode;
    expect(await (await fetch(`${baseUrl}/auth/local-telegram`)).json()).toEqual({ enabled: false });
    expect((await login()).status).toBe(404);
    expect((await protectedRequest(token)).status).toBe(401);
    expect(UserService.prototype.findOrCreate).not.toHaveBeenCalled();
  });

  it('requires explicit opt-in and rejects previously issued local sessions after opt-out', async () => {
    const token = generateLocalTelegramToken(42);
    config.localTelegramLogin = false;
    expect((await login()).status).toBe(404);
    expect((await protectedRequest(token)).status).toBe(401);
    expect(UserService.prototype.findOrCreate).not.toHaveBeenCalled();
  });

  it.each([
    { Host: 'public.example' },
    { Origin: 'https://public.example' },
    { Origin: 'null' },
  ])('rejects non-local hosts and origins: %j', async (headers) => {
    expect((await login(headers)).status).toBe(404);
    expect((await protectedRequest(generateLocalTelegramToken(42), headers)).status).toBe(401);
    expect(UserService.prototype.findOrCreate).not.toHaveBeenCalled();
  });

  it('requires a loopback socket even with a local Host header', () => {
    const request = {
      hostname: 'localhost',
      socket: { remoteAddress: '192.168.1.50' },
      get: () => undefined,
    } as unknown as Request;
    expect(isLocalTelegramRequest(request)).toBe(false);
  });

  it('accepts loopback IPv6 requests', () => {
    const request = {
      hostname: '[::1]',
      socket: { remoteAddress: '::1' },
      get: () => 'http://[::1]:5173',
    } as unknown as Request;
    expect(isLocalTelegramRequest(request)).toBe(true);
  });

  it('rejects unmarked tokens for the reserved local identity', async () => {
    expect((await protectedRequest(generateToken(42, LOCAL_TELEGRAM_ID))).status).toBe(401);
  });

  it('continues accepting ordinary authenticated sessions in production', async () => {
    const token = generateToken(7, '123456');
    config.nodeEnv = 'production';
    expect((await protectedRequest(token)).status).toBe(200);
  });

  it('keeps the real Telegram route dependent on Telegram init data', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    expect(response.status).toBe(400);
    expect(UserService.prototype.findOrCreate).not.toHaveBeenCalled();
  });
});
