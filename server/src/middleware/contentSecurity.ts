import {Request,Response,NextFunction} from 'express';
import rateLimit from 'express-rate-limit';
import {contentIdentity,isAdministrator,securityEvent} from '../services/contentProtection';

export function privateContentHeaders(_req:Request,res:Response,next:NextFunction){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Pragma','no-cache');res.vary('Cookie');res.vary('Authorization');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('X-Content-Type-Options','nosniff');next();
}
export async function requireContentAccount(req:Request,res:Response,next:NextFunction){
 try{if(req.get('sec-fetch-site')==='cross-site'){await securityEvent('CROSS_SITE_CONTENT');res.status(403).json({error:'دریافت محتوا از سایت دیگر مجاز نیست.'});return;}await contentIdentity(req);next();}catch(error){next(error);}
}
export const contentPageLimiter=rateLimit({windowMs:5*60_000,max:90,standardHeaders:true,legacyHeaders:false,keyGenerator:async req=>'reader:'+(await contentIdentity(req)).userId,skip:async req=>isAdministrator(await contentIdentity(req)),handler:async(req,res)=>{await securityEvent('PAGE_RATE_LIMIT',(await contentIdentity(req)).userId);res.setHeader('Retry-After','300');res.status(429).json({error:'تعداد صفحه‌های دریافتی زیاد است؛ چند دقیقه بعد ادامه دهید.'});}});
export const contentMediaLimiter=rateLimit({windowMs:5*60_000,max:300,standardHeaders:true,legacyHeaders:false,keyGenerator:async req=>'media:'+(await contentIdentity(req)).userId,skip:async req=>isAdministrator(await contentIdentity(req)),handler:async(req,res)=>{await securityEvent('MEDIA_RATE_LIMIT',(await contentIdentity(req)).userId);res.setHeader('Retry-After','300');res.status(429).json({error:'دریافت فایل‌ها بیش از حد مجاز است؛ چند دقیقه بعد ادامه دهید.'});}});
