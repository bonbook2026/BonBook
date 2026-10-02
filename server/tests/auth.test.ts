import { describe, it, expect } from 'vitest';
import { TelegramAuthService } from '../src/services/telegramAuthService';
import { createTelegramInitData, TEST_BOT_TOKEN } from './helpers';

describe('TelegramAuthService', () => {
  const authService = new TelegramAuthService(TEST_BOT_TOKEN);

  it('should validate valid Telegram init data', () => {
    const initData = createTelegramInitData({ id: 123456, first_name: 'Test' });
    const user = authService.validateInitData(initData);

    expect(user.id).toBe(123456);
    expect(user.first_name).toBe('Test');
  });

  it('should reject invalid hash', () => {
    const initData = createTelegramInitData({ id: 123456, first_name: 'Test' });
    const tampered = initData.replace(/hash=[^&]+/, 'hash=invalidhash');

    expect(() => authService.validateInitData(tampered)).toThrow('hash mismatch');
  });

  it('should reject missing hash', () => {
    const params = new URLSearchParams();
    params.set('user', JSON.stringify({ id: 1, first_name: 'X' }));
    params.set('auth_date', String(Math.floor(Date.now() / 1000)));

    expect(() => authService.validateInitData(params.toString())).toThrow('Missing hash');
  });

  it('should reject expired init data', () => {
    const user = { id: 1, first_name: 'Test' };
    const userData = JSON.stringify(user);
    const authDate = Math.floor(Date.now() / 1000) - 100000; // Way past expiry

    const params = new URLSearchParams();
    params.set('user', userData);
    params.set('auth_date', String(authDate));

    const entries = Array.from(params.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const crypto = require('crypto');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    params.set('hash', hash);

    expect(() => authService.validateInitData(params.toString())).toThrow('expired');
  });

  it('should reject missing user data', () => {
    const params = new URLSearchParams();
    params.set('auth_date', String(Math.floor(Date.now() / 1000)));

    const crypto = require('crypto');
    const entries = Array.from(params.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    params.set('hash', hash);

    expect(() => authService.validateInitData(params.toString())).toThrow('Missing user');
  });
});
