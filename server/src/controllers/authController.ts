import { Request, Response, NextFunction } from 'express';
import { TelegramAuthService } from '../services/telegramAuthService';
import { UserService } from '../services/userService';
import { generateToken, generateLocalTelegramToken } from '../middleware/auth';
import { isLocalTelegramRequest, LOCAL_TELEGRAM_ID } from '../services/localTelegramService';
import { applyVerifiedAccess } from '../services/accessService';
import { publicUser, setSessionCookie } from '../services/sessionService';

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

    const token=generateLocalTelegramToken(user.id);setSessionCookie(res,token);
    res.setHeader('Cache-Control', 'no-store');
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

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { initData } = req.body;
    if (!initData || typeof initData !== 'string') {
      res.status(400).json({ error: 'اطلاعات Telegram ارسال نشده' });
      return;
    }

    const telegramUser = telegramAuth.validateInitData(initData);

    let user = await userService.findOrCreate(
      String(telegramUser.id),
      telegramUser.first_name,
      telegramUser.last_name
    );
    await userService.saveTelegramUsername(user.id, telegramUser.username);
    user = await applyVerifiedAccess(user.id, { telegramId: String(telegramUser.id), username: telegramUser.username });

    const token = generateToken(user.id, user.telegramId);
    setSessionCookie(res, token);
    const profileStatus = userService.isProfileComplete(user);

    res.json({
      token,
      user: publicUser(user),
      profileComplete: profileStatus.complete,
      missingFields: profileStatus.missing,
    });
  } catch (error) {
    next(error);
  }
}
