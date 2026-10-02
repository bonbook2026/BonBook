import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  localTelegramLogin: process.env.ENABLE_LOCAL_TELEGRAM_LOGIN === 'true',

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },

  boncard: {
    apiUrl: process.env.BONCARD_API_URL || '',
    apiKey: process.env.BONCARD_API_KEY || '',
    secretKey: process.env.BONCARD_SECRET_KEY || '',
    callbackUrl: process.env.BONCARD_CALLBACK_URL || '',
  },

  exchangeRate: {
    provider: process.env.EXCHANGE_RATE_PROVIDER || 'navasan',
    apiKey: process.env.EXCHANGE_RATE_API_KEY || '',
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.EMAIL_FROM || 'noreply@bonbook.ir',
  },

  book: {
    priceUsd: parseFloat(process.env.BOOK_PRICE_USD || '8'),
    maxBooksPerOrder: parseInt(process.env.MAX_BOOKS_PER_ORDER || '50', 10),
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
