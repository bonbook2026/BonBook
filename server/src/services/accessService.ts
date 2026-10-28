import prisma from '../lib/prisma';
import { config } from '../config';
import { HttpError } from '../lib/httpError';

export async function applyVerifiedAccess(userId: number, identity: { telegramId?: string; username?: string; googleEmail?: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let owner = user.role === 'OWNER';
  const username = identity.username?.replace(/^@/, '').toLowerCase();
  if (identity.telegramId && config.owners.telegramUsername && username === config.owners.telegramUsername) {
    const claim = await prisma.siteSetting.upsert({ where: { key: 'owner_telegram_id' },
      create: { key: 'owner_telegram_id', value: identity.telegramId }, update: {} });
    owner ||= claim.value === identity.telegramId;
  }
  const email = identity.googleEmail?.toLowerCase();
  if (email && config.owners.googleEmails.includes(email)) owner = true;
  if (owner) return prisma.user.update({ where: { id: userId }, data: { role: 'OWNER' } });
  const candidates = await prisma.adminGrant.findMany({ where: { OR: [
    { claimedUserId: userId },
    ...(identity.telegramId ? [{ kind: 'TELEGRAM_ID', identifier: identity.telegramId, claimedUserId: null }] : []),
    ...(username ? [{ kind: 'TELEGRAM_USERNAME', identifier: username, claimedUserId: null }] : []),
    ...(email ? [{ kind: 'GOOGLE_EMAIL', identifier: email, claimedUserId: null }] : []),
  ] } });
  for (const grant of candidates) {
    if (!grant.claimedUserId) await prisma.adminGrant.updateMany({ where: { id: grant.id, claimedUserId: null }, data: { claimedUserId: userId } });
  }
  const active = await prisma.adminGrant.count({ where: { claimedUserId: userId } });
  return prisma.user.update({ where: { id: userId }, data: { role: active ? 'ADMIN' : 'READER' } });
}

export function parseAdminTarget(value: unknown) {
  if (typeof value !== 'string') throw new HttpError(400, 'شناسهٔ ادمین را وارد کنید.');
  const input = value.trim().toLowerCase();
  if (/^\d{5,16}$/.test(input)) return { kind: 'TELEGRAM_ID', identifier: input };
  if (/^@[a-z][a-z0-9_]{4,31}$/.test(input)) return { kind: 'TELEGRAM_USERNAME', identifier: input.slice(1) };
  if (/^[^\s@]+@gmail\.com$/.test(input)) return { kind: 'GOOGLE_EMAIL', identifier: input };
  throw new HttpError(400, 'شناسهٔ عددی تلگرام، نام کاربری با @ یا آدرس جیمیل معتبر وارد کنید.');
}
