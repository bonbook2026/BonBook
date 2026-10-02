import crypto from 'crypto';

export const TEST_BOT_TOKEN = 'test-bot-token-123456';

export function createTelegramInitData(user: { id: number; first_name: string; last_name?: string }, botToken: string = TEST_BOT_TOKEN): string {
  const userData = JSON.stringify(user);
  const authDate = Math.floor(Date.now() / 1000);

  const params = new URLSearchParams();
  params.set('user', userData);
  params.set('auth_date', String(authDate));

  const entries = Array.from(params.entries());
  entries.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', hash);
  return params.toString();
}
