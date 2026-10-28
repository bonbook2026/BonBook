import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../services/userService';
import { publicUser } from '../services/sessionService';

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
      user: publicUser(user),
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
      user: publicUser(user),
      profileComplete: profileStatus.complete,
      missingFields: profileStatus.missing,
    });
  } catch (error) {
    next(error);
  }
}
