import prisma from '../lib/prisma';
import validator from 'validator';

export class UserService {
  async findOrCreate(telegramId: string, firstName?: string, lastName?: string) {
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          firstName: firstName || null,
          lastName: lastName || null,
        },
      });
    }

    return user;
  }

  async getById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  }

  async getByTelegramId(telegramId: string) {
    return prisma.user.findUnique({ where: { telegramId } });
  }

  async updateProfile(userId: number, data: { firstName?: string; lastName?: string; email?: string }) {
    if (data.email) {
      if (!validator.isEmail(data.email)) {
        throw new Error('آدرس ایمیل معتبر نیست');
      }
    }

    if (data.firstName !== undefined) {
      data.firstName = validator.escape(validator.trim(data.firstName));
      if (!data.firstName) throw new Error('نام نمی‌تواند خالی باشد');
    }

    if (data.lastName !== undefined) {
      data.lastName = validator.escape(validator.trim(data.lastName));
      if (!data.lastName) throw new Error('نام خانوادگی نمی‌تواند خالی باشد');
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      },
    });
  }

  isProfileComplete(user: { firstName: string | null; lastName: string | null; email: string | null }): {
    complete: boolean;
    missing: string[];
  } {
    const missing: string[] = [];
    if (!user.firstName) missing.push('نام');
    if (!user.lastName) missing.push('نام خانوادگی');
    if (!user.email) missing.push('ایمیل');
    return { complete: missing.length === 0, missing };
  }
}
