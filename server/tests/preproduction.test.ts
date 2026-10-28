import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AuthRequest } from '../src/middleware/auth';
import { config } from '../src/config';
import { validatePreproductionConfig } from '../src/config/preproduction';
import { initiatePayment, paymentCallback, verifyPaymentManual } from '../src/controllers/paymentController';

const saved = {
  preproduction: config.preproduction, nodeEnv: config.nodeEnv,
  jwtSecret: config.jwtSecret, localTelegramLogin: config.localTelegramLogin,
  telegram: config.telegram, frontendUrl: config.frontendUrl,
};

describe('Isolated preproduction', () => {
  beforeEach(() => {
    config.preproduction = true;
    config.nodeEnv = 'production';
    config.localTelegramLogin = false;
    config.jwtSecret = 'dedicated-test-secret-at-least-32-characters';
    config.telegram = { botToken: `123456789:${'a'.repeat(35)}` };
    config.frontendUrl = 'https://staging.example.com/bonbook-preproduction/';
    vi.stubEnv('DATABASE_URL', 'file:./isolated-test.db');
  });

  afterEach(() => {
    Object.assign(config, saved);
    vi.unstubAllEnvs();
  });

  it('accepts a dedicated private environment and rejects insecure defaults', () => {
    expect(() => validatePreproductionConfig()).not.toThrow();
    config.jwtSecret = 'dev-secret-change-in-production';
    expect(() => validatePreproductionConfig()).toThrow('JWT');
  });

  it('rejects the local login simulator and missing Telegram credentials', () => {
    config.localTelegramLogin = true;
    expect(() => validatePreproductionConfig()).toThrow('real Telegram');
    config.localTelegramLogin = false;
    config.telegram.botToken = '';
    expect(() => validatePreproductionConfig()).toThrow('Telegram bot token');
  });

  it('requires HTTPS and a separate configured database', () => {
    config.frontendUrl = 'http://staging.example.com/';
    expect(() => validatePreproductionConfig()).toThrow('HTTPS');
    config.frontendUrl = saved.frontendUrl.startsWith('https:') ? saved.frontendUrl : 'https://staging.example.com/';
    vi.stubEnv('DATABASE_URL', '');
    expect(() => validatePreproductionConfig()).toThrow('database');
  });

  it('blocks all payment entry points before they can charge or verify a payment', async () => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();
    await initiatePayment({ body: { orderId: 1 } } as AuthRequest, response, next);
    await paymentCallback({ query: { payment_id: 'test', order_id: '1' } } as unknown as Request, response, next);
    await verifyPaymentManual({ body: { orderId: 1, paymentId: 'test' } } as AuthRequest, response, next);
    expect(response.status).toHaveBeenCalledTimes(3);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
