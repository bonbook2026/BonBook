import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../services/userService';

const userService = new UserService();

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await userService.getById(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'کاربر یافت نشد' });
      return;
    }

    const profileStatus = userService.isProfileComplete(user);

    res.json({
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

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, email } = req.body;

    const user = await userService.updateProfile(req.userId!, { firstName, lastName, email });
    const profileStatus = userService.isProfileComplete(user);

    res.json({
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
