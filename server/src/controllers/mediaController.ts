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

export async function uploadMedia(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const kind = String(req.params.kind);
    if (!req.file || !['cover', 'audio'].includes(kind)) throw new HttpError(400, 'فایل را انتخاب کنید.');
    if (kind === 'cover' && req.file.size > 8 * 1024 * 1024) throw new HttpError(400, 'حجم جلد حداکثر ۸ مگابایت است.');
    const detected = detectMedia(req.file.buffer, kind);
    const id = crypto.randomUUID(), filename = id + '.' + detected.extension;
    await fs.mkdir(config.mediaDirectory, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(config.mediaDirectory, filename), req.file.buffer, { mode: 0o600, flag: 'wx' });
    try {
      await prisma.mediaAsset.create({ data: { id, filename, kind, mimeType: detected.mimeType, size: req.file.size, createdById: req.userId! } });
    } catch (error) { await fs.unlink(path.join(config.mediaDirectory, filename)); throw error; }
    res.status(201).json({ asset: { id, kind, url: `/api/media/${id}`, size: req.file.size } });
  } catch (error) { next(error); }
}
export async function readMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'فایل پیدا نشد.');
    const media = await prisma.mediaAsset.findUnique({ where: { id }, include: {
      covers: { where: { status: 'PUBLISHED' }, select: { id: true }, take: 1 },
      audioPages: { where: { book: { status: 'PUBLISHED' } }, select: { id: true }, take: 1 },
    } });
    if (!media) throw new HttpError(404, 'فایل پیدا نشد.');
    const published = media.covers.length || media.audioPages.length;
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
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Cache-Control', published ? 'public, max-age=300' : 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.resolve(config.mediaDirectory, media.filename));
  } catch (error) { next(error); }
}
