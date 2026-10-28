import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { config } from '../config';
import { HttpError } from '../lib/httpError';
import { AuthRequest } from '../middleware/auth';
import { cookieValue, SESSION_COOKIE } from '../services/sessionService';
import { detectMedia } from '../services/mediaService';
import {pdfPageImage} from '../services/pageImageService';
import {isPublicHeroMedia} from '../services/libraryHeroService';

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
      const bearer = req.get('authorization')?.replace(/^Bearer /, '') || cookieValue(req, SESSION_COOKIE);
      let permitted = false;
      try {
        const token = jwt.verify(bearer || '', config.jwtSecret) as { userId: number };
        const viewer = await prisma.user.findUnique({ where: { id: token.userId } });
        permitted = Boolean(viewer && ['OWNER', 'ADMIN'].includes(viewer.role));
      } catch { /* A draft asset is private. */ }
      if (!permitted) throw new HttpError(404, 'فایل پیدا نشد.');
    }
    return {media,published};
}
export async function readMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const {media,published}=await accessibleMedia(req);
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Cache-Control', published ? 'private, no-cache' : 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if(media.kind==='document'&&!media.mimeType.startsWith('image/')&&media.mimeType!=='application/pdf')res.attachment(media.filename);
    res.sendFile(path.resolve(config.mediaDirectory, media.filename));
  } catch (error) { next(error); }
}
export async function readPdfPageImage(req:Request,res:Response,next:NextFunction){try{
 const {media,published}=await accessibleMedia(req),number=Number(req.params.page);
 if(media.mimeType!=='application/pdf'||!Number.isSafeInteger(number)||number<1||number>2000)throw new HttpError(404,'تصویر صفحه پیدا نشد.');
 const filename=await pdfPageImage(media.id,media.filename,number);res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control',published?'private, no-cache':'private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.sendFile(filename);
}catch(e){next(e);}}
