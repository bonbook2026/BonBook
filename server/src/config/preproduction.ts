import { config } from './index';

export function validatePreproductionConfig() {
  if (!config.preproduction) return;
  if (config.nodeEnv !== 'production' || config.localTelegramLogin) {
    throw new Error('Preproduction requires production mode and real Telegram authentication.');
  }
  if (config.jwtSecret.length < 32 || /^(your_|dev-secret|change)/i.test(config.jwtSecret)) {
    throw new Error('A dedicated preproduction JWT secret is required.');
  }
  if (!/^\d{6,15}:[A-Za-z0-9_-]{30,}$/.test(config.telegram.botToken)) {
    throw new Error('A Telegram bot token is required for preproduction.');
  }
  if (new URL(config.frontendUrl).protocol !== 'https:') {
    throw new Error('Preproduction requires a public HTTPS URL.');
  }
  if (!process.env.DATABASE_URL) throw new Error('An isolated preproduction database is required.');
}
