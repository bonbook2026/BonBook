import {Response,NextFunction} from 'express';
import {AuthRequest} from '../middleware/auth';
import prisma from '../lib/prisma';
import {accountWatermark,watermarkAccount,securityEvent,contentIdentity} from '../services/contentProtection';
import {HttpError} from '../lib/httpError';

export async function contentSecurity(req:AuthRequest,res:Response,next:NextFunction){try{
 res.setHeader('Cache-Control','private, no-store');
 const code=typeof req.query.code==='string'?req.query.code.trim().toUpperCase():'',userId=code?watermarkAccount(code):null;
 if(code&&!userId)throw new HttpError(400,'شناسهٔ واترمارک معتبر نیست.');
 const now=new Date(),since=new Date(Date.now()-24*3600_000);
 const [sessions,events,active,blocked]=await Promise.all([
  prisma.contentSession.findMany({where:{expiresAt:{gt:now},revokedAt:null,...(userId?{userId}:{})},orderBy:{createdAt:'desc'},take:50}),
  prisma.contentSecurityEvent.findMany({where:{createdAt:{gte:since},...(userId?{userId}:{})},orderBy:{createdAt:'desc'},take:50}),
  prisma.contentSession.count({where:{expiresAt:{gt:now},revokedAt:null}}),prisma.contentSecurityEvent.count({where:{createdAt:{gte:since},kind:{not:'SESSION_REVOKED'}}})
 ]);
 const users=await prisma.user.findMany({where:{id:{in:[...new Set([...sessions.map(row=>row.userId),...events.map(row=>row.userId).filter((id):id is number=>id!==null),...(userId?[userId]:[])])]}},select:{id:true,firstName:true,lastName:true,role:true}});
 const current=(await contentIdentity(req)).sessionId,publicAccount=(id:number|null)=>id?{id,firstName:null,lastName:null,role:'REMOVED',...users.find(user=>user.id===id),watermark:accountWatermark(id)}:null;
 res.json({activeSessions:active,blockedEvents24h:blocked,account:userId?publicAccount(userId):null,sessions:sessions.map(row=>({id:row.id,current:row.id===current,account:publicAccount(row.userId),createdAt:row.createdAt,expiresAt:row.expiresAt})),events:events.map(row=>({id:row.id,kind:row.kind,createdAt:row.createdAt,account:publicAccount(row.userId)}))});
}catch(error){next(error);}}
export async function revokeContentSession(req:AuthRequest,res:Response,next:NextFunction){try{
 const id=String(req.params.sessionId);if(!/^[a-f0-9]{64}$/.test(id))throw new HttpError(400,'شناسهٔ نشست معتبر نیست.');
 const session=await prisma.contentSession.findUnique({where:{id}});if(!session)throw new HttpError(404,'نشست پیدا نشد.');
 await prisma.contentSession.update({where:{id},data:{revokedAt:new Date()}});await securityEvent('SESSION_REVOKED',session.userId);
 res.setHeader('Cache-Control','no-store');res.json({ok:true});
}catch(error){next(error);}}
