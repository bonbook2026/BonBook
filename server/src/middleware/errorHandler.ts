import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/httpError';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
  console.error('Error:', err.message);

  if (err.message.includes('نامعتبر') || err.message.includes('Invalid')) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.message.includes('یافت نشد') || err.message.includes('not found')) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (err.message.includes('credentials') || err.message.includes('configured')) {
    res.status(503).json({ error: 'سرویس در حال حاضر در دسترس نیست. لطفاً بعداً تلاش کنید.' });
    return;
  }

  res.status(500).json({ error: 'خطای داخلی سرور. لطفاً دوباره تلاش کنید.' });
}
