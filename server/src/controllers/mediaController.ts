import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../lib/prisma';
import { config } from '../config';
import { HttpError } from '../lib/httpError';
import { AuthRequest } from '../middleware/auth';
import { detectMedia } from '../services/mediaService';
import {pdfPageImage} from '../services/pageImageService';
import {isPublicHeroMedia} from '../services/libraryHeroService';
import {requestIsAdmin} from '../middleware/admin';
import {contentIdentity,isAdministrator,verifyMediaGrant,securityEvent} from '../services/contentProtection';
import {contentMediaLimiter} from '../middleware/contentSecurity';
import {watermarkedImage} from '../services/watermarkService';

export async function uploadMedia(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const kind = String(req.params.kind);
    if (!req.file || !['cover', 'audio','page-image'].includes(kind)) throw new HttpError(400, 'فایل را انتخاب کنید.');
    if (kind !== 'audio' && req.file.size > 8 * 1024 * 1024) throw new HttpError(400, 'حجم تصویر حداکثر ۸ مگابایت است.');
    const detected = detectMedia(req.file.buffer, kind==='page-image'?'cover':kind);
    const id = crypto.randomUUID(), filename = id + '.' + detected.extension;
    await fs.mkdir(config.mediaDirectory, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(config.mediaDirectory, filename), req.file.buffer, { mode: 0o600, flag: 'wx' });
    try {
      await prisma.mediaAsset.create({ data: { id, filename, kind, mimeType: detected.mimeType, size: req.file.size, createdById: req.userId! } });
    } catch (error) { await fs.unlink(path.join(config.mediaDirectory, filename)); throw error; }
    res.status(201).json({ asset: { id, kind, url: `/api/media/${id}`, size: req.file.size } });
  } catch (error) { next(error); }
}
async function accessibleMedia(req:Request){
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'فایل پیدا نشد.');
    const media = await prisma.mediaAsset.findUnique({ where: { id }, include: {
      covers: { where: { status: 'PUBLISHED' }, select: { id: true }, take: 1 },
      audioPages: { where: { book: { status: 'PUBLISHED' } }, select: { id: true }, take: 1 },
      pageImages:{where:{book:{status:'PUBLISHED'}},select:{id:true},take:1},
      sourcePages:{where:{book:{status:'PUBLISHED'}},select:{id:true},take:1},
    } });
    if (!media) throw new HttpError(404, 'فایل پیدا نشد.');
    const published = Boolean(media.covers.length || media.audioPages.length || media.sourcePages.length||media.pageImages.length||await isPublicHeroMedia(id));
    if (!published) {
      if (!await requestIsAdmin(req)) throw new HttpError(404, 'فایل پیدا نشد.');
    }
    return {media,published,protectedMedia:Boolean(media.kind==='audio'||media.audioPages.length||media.pageImages.length||media.sourcePages.length)};
}
async function mediaIdentity(req:Request,id:string){
 if(req.get('sec-fetch-site')==='cross-site'){await securityEvent('CROSS_SITE_CONTENT',null,id);throw new HttpError(403,'دریافت محتوا از سایت دیگر مجاز نیست.');}
 try{return await contentIdentity(req);}catch(error){await securityEvent('UNAUTHENTICATED_MEDIA',null,id);throw error;}
}
function limitedMedia(req:Request,res:Response,next:NextFunction,serve:()=>Promise<void>){void contentMediaLimiter(req,res,error=>{if(error){next(error);return;}void serve().catch(next);});}
export async function readMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const {media,protectedMedia}=await accessibleMedia(req);
    if(media.kind==='document'&&!media.mimeType.startsWith('image/')&&!await requestIsAdmin(req))throw new HttpError(403,'دسترسی به فایل اصلی کتاب فقط برای مدیریت فعال است.');
    if(protectedMedia){
      const identity=await mediaIdentity(req,media.id),rawAdmin=isAdministrator(identity)&&!req.query.grant&&!req.query.expires;
      if(!rawAdmin)await verifyMediaGrant(req,identity);
      limitedMedia(req,res,next,async()=>{
        const filename=path.resolve(config.mediaDirectory,media.filename);
        if(media.mimeType.startsWith('image/')&&!rawAdmin){res.type('image/png').send(await watermarkedImage(filename,identity.watermark));return;}
        res.setHeader('Content-Type',media.mimeType);if(rawAdmin&&media.kind==='document'&&!media.mimeType.startsWith('image/')&&media.mimeType!=='application/pdf')res.attachment(media.filename);else res.setHeader('Content-Disposition','inline');res.sendFile(filename);
      });return;
    }
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if(media.kind==='document'&&!media.mimeType.startsWith('image/')&&media.mimeType!=='application/pdf')res.attachment(media.filename);
    res.sendFile(path.resolve(config.mediaDirectory, media.filename));
  } catch (error) { next(error); }
}
export async function readPdfPageImage(req:Request,res:Response,next:NextFunction){try{
 const {media}=await accessibleMedia(req),number=Number(req.params.page);
 if(media.mimeType!=='application/pdf'||!Number.isSafeInteger(number)||number<1||number>2000)throw new HttpError(404,'تصویر صفحه پیدا نشد.');
 const identity=await mediaIdentity(req,media.id),rawAdmin=isAdministrator(identity)&&!req.query.grant&&!req.query.expires;
 if(!rawAdmin){await verifyMediaGrant(req,identity);if(!await prisma.libraryPage.findFirst({where:{sourceAssetId:media.id,sourcePageNumber:number,book:{status:'PUBLISHED'}},select:{id:true}}))throw new HttpError(404,'این صفحه منتشر نشده است.');}
 limitedMedia(req,res,next,async()=>{const filename=await pdfPageImage(media.id,media.filename,number);res.type('image/png');if(rawAdmin)res.sendFile(filename);else res.send(await watermarkedImage(filename,identity.watermark));});
}catch(e){next(e);}}
