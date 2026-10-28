import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../server/package.json', import.meta.url));
const dotenv = require('dotenv');
const options = new Map(process.argv.slice(2).map((arg) => {
  const separator = arg.indexOf('=');
  return [arg.slice(0, separator), arg.slice(separator + 1)];
}));
const source = dotenv.parse(fs.readFileSync(path.join(root, '.env.example.local')));
const token = source.TELEGRAM_BOT_TOKEN || '';
if (!/^\d{6,15}:[A-Za-z0-9_-]{30,}$/.test(token)) {
  throw new Error('The local file must contain a Telegram bot token.');
}
const target = path.join(root, 'server/.env.preproduction');
const existing = fs.existsSync(target) ? dotenv.parse(fs.readFileSync(target)) : {};
const publicUrl = options.get('--public-url') || existing.FRONTEND_URL;
if (!publicUrl || new URL(publicUrl).protocol !== 'https:') throw new Error('Supply --public-url=https://host/path/.');
const secret = existing.JWT_SECRET && existing.JWT_SECRET.length >= 32 && !/^(your_|dev-secret|change)/i.test(existing.JWT_SECRET)
  ? existing.JWT_SECRET : crypto.randomBytes(48).toString('hex');
const values = {
  NODE_ENV: 'production', APP_ENV: 'preproduction', HOST: '127.0.0.1',
  PORT: options.get('--port') || existing.PORT || '3135',
  TELEGRAM_BOT_TOKEN: token, JWT_SECRET: secret, ENABLE_LOCAL_TELEGRAM_LOGIN: 'false',
  DATABASE_URL: options.get('--database-url') || existing.DATABASE_URL || 'file:./bonbook.preproduction.db',
  FRONTEND_URL: new URL(publicUrl).href, BOOK_PRICE_TOMAN: '1500000', MAX_BOOKS_PER_ORDER: '50',
  BOOK_MEDIA_DIR: existing.BOOK_MEDIA_DIR || '/srv/bonbook-preproduction/shared/data/media',
  OWNER_TELEGRAM_USERNAME: source.OWNER_TELEGRAM_USERNAME || existing.OWNER_TELEGRAM_USERNAME || '',
  OWNER_GOOGLE_EMAILS: source.OWNER_GOOGLE_EMAILS || existing.OWNER_GOOGLE_EMAILS || '',
  GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID || existing.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET || existing.GOOGLE_CLIENT_SECRET || '',
};
fs.writeFileSync(target, Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
console.log('Prepared the ignored server/.env.preproduction using only named BonBook identity settings. Secret values were not logged.');
