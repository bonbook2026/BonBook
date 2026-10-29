import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../lib/prisma';
import {verifiedRateLimitAccount} from './rateLimiter';

export async function requestIsAdmin(req:Request){
  const id=verifiedRateLimitAccount(req);
  const user=id?await prisma.user.findUnique({where:{id},select:{role:true}}):null;
  return Boolean(user&&['OWNER','ADMIN'].includes(user.role));
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !['OWNER', 'ADMIN'].includes(user.role)) { res.status(403).json({ error: 'دسترسی مدیریت ندارید.' }); return; }
    req.adminRole = user.role;
    next();
  } catch (error) { next(error); }
}

export function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.adminRole !== 'OWNER') { res.status(403).json({ error: 'مدیریت ادمین‌ها فقط برای مالک فعال است.' }); return; }
  next();
}
