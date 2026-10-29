import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../lib/prisma';
import {contentIdentity,isAdministrator} from '../services/contentProtection';

export async function requestIsAdmin(req:Request){
  try{return isAdministrator(await contentIdentity(req));}catch{return false;}
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
  if (req.adminRole !== 'OWNER') { res.status(403).json({ error: 'این بخش فقط برای مالک فعال است.' }); return; }
  next();
}
