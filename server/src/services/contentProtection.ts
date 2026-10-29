import crypto from 'crypto';
import {Request} from 'express';
import jwt,{JwtPayload} from 'jsonwebtoken';
import {config} from '../config';
import prisma from '../lib/prisma';
import {HttpError} from '../lib/httpError';
import {cookieValue,SESSION_COOKIE} from './sessionService';
import {isLocalTelegramRequest,LOCAL_TELEGRAM_ID} from './localTelegramService';

const identities=new WeakMap<Request,Promise<ContentIdentity>>(),events=new Map<string,number>();
let maintenanceAfter=0;
function maintainSecurityHistory(){if(Date.now()<maintenanceAfter)return;maintenanceAfter=Date.now()+5*60_000;void Promise.all([prisma.contentSession.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-7*24*3600_000)}}}),prisma.contentSecurityEvent.deleteMany({where:{createdAt:{lt:new Date(Date.now()-30*24*3600_000)}}})]).catch(()=>{});}
export interface ContentIdentity{userId:number;role:string;sessionId:string;token:string;expires:number;watermark:string}
const mac=(purpose:string,value:string)=>crypto.createHmac('sha256',config.jwtSecret).update(purpose+'\0'+value).digest('hex');
export function accountWatermark(id:number){return `BB-${id.toString(36).toUpperCase()}-${mac('watermark',String(id)).slice(0,8).toUpperCase()}`;}
export function watermarkAccount(code:string){const match=/^BB-([0-9A-Z]+)-[0-9A-F]{8}$/.exec(code.toUpperCase()),id=match?parseInt(match[1],36):0;return Number.isSafeInteger(id)&&id>0&&accountWatermark(id)===code.toUpperCase()?id:null;}
export async function securityEvent(kind:string,userId:number|null=null,assetId:string|null=null){
 const now=Date.now(),key=kind+':'+(userId||'guest');if(now-(events.get(key)||0)<60_000)return;events.set(key,now);if(events.size>1000)events.delete(events.keys().next().value!);
 await prisma.contentSecurityEvent.create({data:{kind,userId,assetId}}).catch(()=>{});
}
export function sessionToken(req:Request){const bearer=req.get('authorization');return bearer?.startsWith('Bearer ')?bearer.slice(7):cookieValue(req,SESSION_COOKIE)||'';}
function tokenIdentity(req:Request){
 const token=sessionToken(req);let payload:JwtPayload;
 try{payload=jwt.verify(token,config.jwtSecret,{algorithms:['HS256']}) as JwtPayload;}catch{throw new HttpError(401,'برای خواندن و شنیدن کتاب، دوباره وارد حساب شوید.');}
 if(!Number.isSafeInteger(payload.userId)||payload.userId<1||typeof payload.telegramId!=='string'||typeof payload.exp!=='number')throw new HttpError(401,'نشست ورود معتبر نیست.');
 if((payload.localTelegram&&(!isLocalTelegramRequest(req)||payload.telegramId!==LOCAL_TELEGRAM_ID))||(payload.telegramId===LOCAL_TELEGRAM_ID&&payload.localTelegram!==true))throw new HttpError(401,'نشست آزمایشی روی این سایت معتبر نیست.');
 return {token,payload,id:crypto.createHash('sha256').update(token).digest('hex')};
}
export function contentIdentity(req:Request){
 let pending=identities.get(req);if(pending)return pending;
 pending=(async()=>{
  const {token,payload,id}=tokenIdentity(req);
  const [user,session]=await Promise.all([prisma.user.findUnique({where:{id:payload.userId},select:{id:true,role:true,telegramId:true}}),prisma.contentSession.findUnique({where:{id}})]);
  if(!user||user.telegramId!==payload.telegramId||session?.revokedAt)throw new HttpError(401,'این نشست پایان یافته است؛ دوباره وارد حساب شوید.');
  const registered=session||await prisma.contentSession.upsert({where:{id},create:{id,userId:user.id,expiresAt:new Date(payload.exp!*1000)},update:{}});
  if(registered.revokedAt)throw new HttpError(401,'این نشست پایان یافته است؛ دوباره وارد حساب شوید.');
  maintainSecurityHistory();
  // No raw session credentials are written to audit records or returned in grants.
  return {userId:user.id,role:user.role,sessionId:id,token,expires:payload.exp!,watermark:accountWatermark(user.id)};
 })();identities.set(req,pending);return pending;
}
export async function revokeRequestSession(req:Request){
 try{const {id,payload}=tokenIdentity(req);await prisma.contentSession.upsert({where:{id},create:{id,userId:payload.userId,expiresAt:new Date(payload.exp!*1000),revokedAt:new Date()},update:{revokedAt:new Date()}});}catch(error){if(!(error instanceof HttpError))throw error;}
}
export const isAdministrator=(identity:ContentIdentity)=>['OWNER','ADMIN'].includes(identity.role);
export function signedMediaUrl(route:string,identity:ContentIdentity,audio=false){
 const expires=Math.min(identity.expires,Math.floor(Date.now()/1000)+(audio?4*3600:3600));
 return `${route}?expires=${expires}&grant=${mac('media',`${route}\n${expires}\n${identity.sessionId}`)}`;
}
export async function verifyMediaGrant(req:Request,identity:ContentIdentity){
 const expires=typeof req.query.expires==='string'?req.query.expires:'',grant=typeof req.query.grant==='string'?req.query.grant:'';
 const route='/api/media/'+req.params.id+(req.params.page?`/pages/${req.params.page}/image`:''),now=Math.floor(Date.now()/1000);
 const expected=mac('media',`${route}\n${expires}\n${identity.sessionId}`);
 if(!/^\d{10}$/.test(expires)||Number(expires)<now||Number(expires)>Math.min(identity.expires,now+4*3600)||!/^[a-f0-9]{64}$/.test(grant)||!crypto.timingSafeEqual(Buffer.from(grant,'hex'),Buffer.from(expected,'hex'))){await securityEvent('INVALID_MEDIA_GRANT',identity.userId,String(req.params.id));throw new HttpError(403,'مجوز این فایل معتبر نیست یا منقضی شده است؛ صفحهٔ کتاب را دوباره باز کنید.');}
}
