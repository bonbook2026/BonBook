import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../lib/prisma';

const verifiedAccounts=new WeakMap<Request,number|null>();
export function verifiedRateLimitAccount(req:Request):number|null{
  if(verifiedAccounts.has(req))return verifiedAccounts.get(req)!;
  let account:number|null=null;
  try{
    const bearer=req.get('authorization');
    const cookie=req.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('bonbook_session='));
    const token=bearer?.startsWith('Bearer ')?bearer.slice(7):decodeURIComponent(cookie?.slice('bonbook_session='.length)||'');
    const identity=jwt.verify(token,config.jwtSecret,{algorithms:['HS256']}) as {userId?:number;telegramId?:string};
    if(typeof identity.userId==='number'&&Number.isSafeInteger(identity.userId)&&identity.userId>0&&typeof identity.telegramId==='string')account=identity.userId;
  }catch{ /* Invalid or expired credentials keep the unchanged anonymous IP budget. */ }
  verifiedAccounts.set(req,account);return account;
}
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Approved specifically for authenticated BonBook use; anonymous protection stays at 100.
  max: req => verifiedRateLimitAccount(req) ? 600 : 100,
  // Owner/admin work is exempt only after checking the current server-side role.
  skip:async req=>{
    const id=verifiedRateLimitAccount(req);
    if(!id)return false;
    const account=await prisma.user.findUnique({where:{id},select:{role:true}});
    return Boolean(account&&['OWNER','ADMIN'].includes(account.role));
  },
  keyGenerator:req=>{const account=verifiedRateLimitAccount(req);return account?'account:'+account:'ip:'+(req.ip||req.socket.remoteAddress||'unknown');},
  handler:(req,res)=>{
    const reset=(req as Request & {rateLimit?:{resetTime?:Date}}).rateLimit?.resetTime;
    const retryAfterSeconds=Math.max(1,Math.ceil(((reset?.getTime()||Date.now()+60_000)-Date.now())/1000));
    res.setHeader('Retry-After',String(retryAfterSeconds));
    res.status(429).json({error:`تعداد درخواست‌ها بیش از حد مجاز است. ${Math.ceil(retryAfterSeconds/60).toLocaleString('fa-IR')} دقیقهٔ دیگر دوباره تلاش کنید.`,retryAfterSeconds});
  },
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
