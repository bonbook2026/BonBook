import crypto from 'crypto';
import { config } from '../config';
import { TelegramUser } from '../types';

export class TelegramAuthService {
  private botToken: string;

  constructor(botToken?: string) {
    this.botToken = botToken || config.telegram.botToken;
  }

  validateInitData(initData: string): TelegramUser {
    if (!this.botToken) {
      throw new Error('Telegram bot token is not configured');
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      throw new Error('Missing hash in Telegram init data');
    }

    params.delete('hash');
    const entries = Array.from(params.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(this.botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      throw new Error('Invalid Telegram init data: hash mismatch');
    }

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 86400; // 24 hours
    if (now - authDate > maxAge) {
      throw new Error('Telegram init data has expired');
    }

    const userStr = params.get('user');
    if (!userStr) {
      throw new Error('Missing user data in Telegram init data');
    }

    const user: TelegramUser = JSON.parse(userStr);
    if (!user.id) {
      throw new Error('Invalid Telegram user data: missing id');
    }

    return user;
  }
}
