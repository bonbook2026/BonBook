import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند دقیقه بعد تلاش کنید.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'تلاش‌های ورود بیش از حد مجاز است.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'تعداد درخواست‌های پرداخت بیش از حد مجاز است.' },
  standardHeaders: true,
  legacyHeaders: false,
});
