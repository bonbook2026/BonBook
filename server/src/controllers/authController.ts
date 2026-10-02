import { Request, Response, NextFunction } from 'express';
import { TelegramAuthService } from '../services/telegramAuthService';
import { UserService } from '../services/userService';
import { generateToken, generateLocalTelegramToken } from '../middleware/auth';
import { isLocalTelegramRequest, LOCAL_TELEGRAM_ID } from '../services/localTelegramService';

const telegramAuth = new TelegramAuthService();
const userService = new UserService();

export function localTelegramStatus(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ enabled: isLocalTelegramRequest(req) });
}

export async function localTelegramLogin(req: Request, res: Response, next: NextFunction) {
  if (!isLocalTelegramRequest(req)) {
    res.status(404).json({ error: 'ورود آزمایشی فقط در محیط توسعهٔ محلی فعال است.' });
    return;
  }

  try {
    // A reserved identity keeps local testing separate from real Telegram accounts.
    const user = await userService.findOrCreate(LOCAL_TELEGRAM_ID, 'کاربر', 'آزمایشی');
    const profileStatus = userService.isProfileComplete(user);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      token: generateLocalTelegramToken(user.id),
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      profileComplete: profileStatus.complete,
      missingFields: profileStatus.missing,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { initData } = req.body;
    if (!initData || typeof initData !== 'string') {
      res.status(400).json({ error: 'اطلاعات Telegram ارسال نشده' });
      return;
    }

    const telegramUser = telegramAuth.validateInitData(initData);

    const user = await userService.findOrCreate(
      String(telegramUser.id),
      telegramUser.first_name,
      telegramUser.last_name
    );

    const token = generateToken(user.id, user.telegramId);
    const profileStatus = userService.isProfileComplete(user);

    res.json({
      token,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      profileComplete: profileStatus.complete,
      missingFields: profileStatus.missing,
    });
  } catch (error) {
    next(error);
  }
}
