import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/httpError';
import { AuthRequest } from '../middleware/auth';
import { rankPages, queryTerms } from '../services/searchService';

export function bookJson(book: any) {
  return { id: book.id, title: book.title, author: book.author, description: book.description,
    category: book.category, language: book.language, coverTone: book.coverTone,
    categoryId:book.categoryId,tags:book.tags||'',deletedAt:book.deletedAt,
    coverUrl: book.coverAssetId ? `/api/media/${book.coverAssetId}` : null,
    coverAssetId: book.coverAssetId, status: book.status, isSample: book.isSample,
    coverLayout: book.coverLayout, coverFrontSide: book.coverFrontSide,
    coverSpineStart: book.coverSpineStart, coverSpineEnd: book.coverSpineEnd,
    pageCount: book._count?.pages ?? book.pages?.length ?? 0, updatedAt: book.updatedAt,
    ...(book.pages ? { pages: book.pages.map((page: any) => ({ number: page.number, heading: page.heading,hasAudio:Boolean(page.audioAssetId) })) } : {}),
    ...(book.contents ? {contents:book.contents.map((entry:any)=>({title:entry.title,pageNumber:entry.pageNumber,level:entry.level}))}: {}) };
}
export function pageJson(page: any) {
  return { id: page.id, bookId: page.bookId, number: page.number, heading: page.heading,
    content: page.content, keywords: page.keywords, audioAssetId: page.audioAssetId,audioCues:JSON.parse(page.audioCues||'[]'),audioCueMode:page.audioCueMode||'NONE',
    sourceUrl:page.sourceAssetId?`/api/media/${page.sourceAssetId}`:null,sourcePageNumber:page.sourcePageNumber||null,sourceMimeType:page.source?.mimeType||null,
    imageAssetId:page.imageAssetId||null,imageUrl:page.imageAssetId?`/api/media/${page.imageAssetId}`:null,visualMode:page.visualMode||'AUTO',
    sourceImageUrl:page.source?.mimeType==='application/pdf'&&page.sourcePageNumber?`/api/media/${page.sourceAssetId}/pages/${page.sourcePageNumber}/image`:page.source?.mimeType.startsWith('image/')?`/api/media/${page.sourceAssetId}`:null,
    audioUrl: page.audioAssetId ? `/api/media/${page.audioAssetId}` : null, updatedAt: page.updatedAt };
}
export const positiveId = (value: unknown) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'شناسه معتبر نیست.');
  return id;
};
export async function listLibrary(req: Request, res: Response, next: NextFunction) {
  try {
    const books = await prisma.libraryBook.findMany({ where: { status: 'PUBLISHED' }, include: { _count: { select: { pages: true } } }, orderBy: { updatedAt: 'desc' } });
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    res.json({ books: books.filter((book) => !category || book.category === category).map(bookJson), categories: [...new Set(books.map((book) => book.category))] });
  } catch (error) { next(error); }
}
export async function getLibraryBook(req: Request, res: Response, next: NextFunction) {
  try {
    const book = await prisma.libraryBook.findFirst({ where: { id: positiveId(req.params.id), status: 'PUBLISHED' }, include: { contents:{orderBy:{position:'asc'}},pages: { select: { number: true, heading: true,audioAssetId:true }, orderBy: { number: 'asc' } } } });
    if (!book) throw new HttpError(404, 'کتاب در دسترس نیست.');
    res.json({ book: bookJson(book) });
  } catch (error) { next(error); }
}
export async function getLibraryPage(req: Request, res: Response, next: NextFunction) {
  try {
    const page = await prisma.libraryPage.findFirst({ where: { bookId: positiveId(req.params.id), number: positiveId(req.params.page), book: { status: 'PUBLISHED' } },include:{source:{select:{mimeType:true}}} });
    if (!page) throw new HttpError(404, 'صفحه در دسترس نیست.');
    res.json({ page: pageJson(page) });
  } catch (error) { next(error); }
}
export async function searchLibrary(req: Request, res: Response, next: NextFunction) {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2 || query.length > 500) throw new HttpError(400, 'موضوع جست‌وجو را بین ۲ تا ۵۰۰ حرف بنویسید.');
    const terms = queryTerms(query);
    if (!terms.length) { res.json({ query, results: [] }); return; }
    const pages = await prisma.libraryPage.findMany({ where: { book: { status: 'PUBLISHED' }, OR: terms.map((term) => ({ searchText: { contains: term } })), ...(req.query.bookId ? { bookId: positiveId(req.query.bookId) } : {}) },
      include: { book: { select: { title: true, author: true, language: true } } }, take: 200 });
    const results = rankPages(query, pages).map((page) => ({ ...pageJson(page), bookTitle: page.book.title, author: page.book.author,
      language: page.book.language, excerpt: page.excerpt, matchedTerms: page.matchedTerms }));
    res.json({ query, results });
  } catch (error) { next(error); }
}
export async function readingProgress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.method === 'GET') {
      const progress = await prisma.readingProgress.findMany({ where: { userId: req.userId, book: { status: 'PUBLISHED' } }, include: { book: { include: { _count: { select: { pages: true } } } } }, orderBy: { updatedAt: 'desc' } });
      res.json({ progress: progress.map((item) => ({ book: bookJson(item.book), pageNumber: item.pageNumber, updatedAt: item.updatedAt })) }); return;
    }
    const bookId = positiveId(req.body.bookId), pageNumber = positiveId(req.body.pageNumber);
    const page = await prisma.libraryPage.findFirst({ where: { bookId, number: pageNumber, book: { status: 'PUBLISHED' } } });
    if (!page) throw new HttpError(404, 'صفحه در دسترس نیست.');
    await prisma.readingProgress.upsert({ where: { userId_bookId: { userId: req.userId!, bookId } },
      create: { userId: req.userId!, bookId, pageNumber }, update: { pageNumber } });
    res.json({ ok: true });
  } catch (error) { next(error); }
}
