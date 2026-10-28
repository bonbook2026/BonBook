import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/httpError';
import { bookJson, pageJson, positiveId } from './libraryController';
import { normalizePersian } from '../services/searchService';
import { parseAdminTarget } from '../services/accessService';

function text(value: unknown, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, 'متن و طول فیلدها را بررسی کنید.');
  return value.trim();
}
async function asset(value: unknown, kind: string) {
  if (!value) return null;
  if (typeof value !== 'string' || !await prisma.mediaAsset.findFirst({ where: { id: value, kind } })) throw new HttpError(400, 'فایل انتخاب‌شده معتبر نیست.');
  return value;
}
export async function adminBooks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.method === 'GET') {
      const books = await prisma.libraryBook.findMany({ include: { _count: { select: { pages: true } } }, orderBy: { updatedAt: 'desc' } });
      res.json({ books: books.map(bookJson) }); return;
    }
    const title = text(req.body.title, 200, true);
    const book = await prisma.libraryBook.create({ data: { title, createdById: req.userId } });
    res.status(201).json({ book: bookJson(book) });
  } catch (error) { next(error); }
}
export async function adminBook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = positiveId(req.params.id);
    const book = await prisma.libraryBook.findUnique({ where: { id }, include: { pages: { orderBy: { number: 'asc' } } } });
    if (!book) throw new HttpError(404, 'کتاب پیدا نشد.');
    if (req.method === 'GET') { res.json({ book: bookJson(book), pages: book.pages.map(pageJson) }); return; }
    if (req.method === 'DELETE') {
      await prisma.libraryBook.update({ where: { id }, data: { status: 'ARCHIVED' } });
      res.json({ ok: true }); return;
    }
    const { title, author, description, category, coverTone, language, status, coverAssetId } = req.body;
    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status) || !['sand', 'blue', 'moss', 'rose', 'ink'].includes(coverTone)) throw new HttpError(400, 'وضعیت یا رنگ جلد معتبر نیست.');
    if (status === 'PUBLISHED' && !book.pages.length) throw new HttpError(400, 'قبل از انتشار، حداقل یک صفحه به کتاب اضافه کنید.');
    const updated = await prisma.libraryBook.update({ where: { id }, data: {
      title: text(title, 200, true), author: text(author, 160), description: text(description, 3000), category: text(category, 80, true),
      coverTone, language: text(language, 20, true), status, coverAssetId: await asset(coverAssetId, 'cover'),
    }, include: { _count: { select: { pages: true } } } });
    res.json({ book: bookJson(updated) });
  } catch (error) { next(error); }
}
export async function savePage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const bookId = positiveId(req.params.id), number = positiveId(req.params.page);
    if (number > 100_000) throw new HttpError(400, 'شمارهٔ صفحه معتبر نیست.');
    if (!await prisma.libraryBook.findUnique({ where: { id: bookId } })) throw new HttpError(404, 'کتاب پیدا نشد.');
    if (req.method === 'DELETE') {
      await prisma.libraryPage.deleteMany({ where: { bookId, number } });
      if (!await prisma.libraryPage.count({ where: { bookId } })) await prisma.libraryBook.update({ where: { id: bookId }, data: { status: 'DRAFT' } });
      res.json({ ok: true }); return;
    }
    const heading = text(req.body.heading, 200), content = text(req.body.content, 40_000, true), keywords = text(req.body.keywords, 600);
    const audioAssetId = await asset(req.body.audioAssetId, 'audio');
    const data = { heading, content, keywords, audioAssetId, searchText: normalizePersian(heading + ' ' + keywords + ' ' + content) };
    const page = await prisma.libraryPage.upsert({ where: { bookId_number: { bookId, number } }, create: { bookId, number, ...data }, update: data });
    await prisma.libraryBook.update({ where: { id: bookId }, data: { updatedAt: new Date() } });
    res.json({ page: pageJson(page) });
  } catch (error) { next(error); }
}
export async function adminAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.method === 'GET') {
      const grants = await prisma.adminGrant.findMany({ orderBy: { createdAt: 'desc' } });
      res.json({ grants }); return;
    }
    if (req.method === 'DELETE') {
      const grant = await prisma.adminGrant.findUnique({ where: { id: positiveId(req.params.grantId) } });
      if (!grant) throw new HttpError(404, 'ادمین پیدا نشد.');
      await prisma.$transaction(async (tx) => {
        await tx.adminGrant.delete({ where: { id: grant.id } });
        if (grant.claimedUserId && !await tx.adminGrant.count({ where: { claimedUserId: grant.claimedUserId } })) {
          await tx.user.updateMany({ where: { id: grant.claimedUserId, role: 'ADMIN' }, data: { role: 'READER' } });
        }
      });
      res.json({ ok: true }); return;
    }
    const target = parseAdminTarget(req.body.identifier);
    const grant = await prisma.adminGrant.upsert({ where: { kind_identifier: target }, create: { ...target, createdById: req.userId! }, update: {} });
    res.status(201).json({ grant });
  } catch (error) { next(error); }
}
