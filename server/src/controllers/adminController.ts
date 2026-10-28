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
      const q=typeof req.query.q==='string'?normalizePersian(req.query.q.trim()).slice(0,200):'',status=typeof req.query.status==='string'?req.query.status:'ALL';
      if(!['ALL','DRAFT','PUBLISHED','HIDDEN','ARCHIVED','TRASH'].includes(status))throw new HttpError(400,'وضعیت معتبر نیست.');
      const page=req.query.page?positiveId(req.query.page):1,pageSize=24;if(page>100000)throw new HttpError(400,'شمارهٔ صفحه معتبر نیست.');
      const categoryIds=new Set<number>();
      if(req.query.categoryId){categoryIds.add(positiveId(req.query.categoryId));const categories=await prisma.bookCategory.findMany({select:{id:true,parentId:true}});let changed=true;while(changed){changed=false;for(const row of categories)if(row.parentId&&categoryIds.has(row.parentId)&&!categoryIds.has(row.id)){categoryIds.add(row.id);changed=true;}}}
      const filters={...(q?{AND:q.split(' ').filter(Boolean).slice(0,12).map(term=>({catalogText:{contains:term}}))}:{}),...(categoryIds.size?{categoryId:{in:[...categoryIds]}}:{})};
      const where={...filters,...(status==='ALL'?{status:{not:'TRASH'}}:{status})};
      const [books,total,groups]=await Promise.all([prisma.libraryBook.findMany({where,include:{_count:{select:{pages:true}}},orderBy:req.query.sort==='title'?{title:'asc'}:{updatedAt:'desc'},skip:(page-1)*pageSize,take:pageSize}),prisma.libraryBook.count({where}),prisma.libraryBook.groupBy({by:['status'],where:filters,_count:{_all:true}})]);
      res.json({books:books.map(bookJson),total,page,pageSize,counts:Object.fromEntries(groups.map(row=>[row.status,row._count._all]))});return;
    }
    const title = text(req.body.title, 200, true);
    const book = await prisma.libraryBook.create({ data: { title, catalogText:normalizePersian(title), createdById: req.userId } });
    res.status(201).json({ book: bookJson(book) });
  } catch (error) { next(error); }
}
export async function adminBook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = positiveId(req.params.id);
    const book = await prisma.libraryBook.findUnique({ where: { id }, include: { pages: { select:{id:true,number:true,heading:true},orderBy: { number: 'asc' } } } });
    if (!book) throw new HttpError(404, 'کتاب پیدا نشد.');
    if (req.method === 'GET') { res.json({ book: bookJson(book), pages: book.pages.map(pageJson) }); return; }
    if (req.method === 'DELETE') {
      await prisma.libraryBook.update({ where: { id }, data: { status: 'TRASH',deletedAt:new Date() } });
      res.json({ ok: true }); return;
    }
    if(book.status==='TRASH')throw new HttpError(409,'ابتدا کتاب را از سطل زباله بازیابی کنید.');
    const { title, author, description, category, coverTone, language, status, coverAssetId } = req.body;
    const coverLayout = req.body.coverLayout ?? book.coverLayout;
    const coverFrontSide = req.body.coverFrontSide ?? book.coverFrontSide;
    const coverSpineStart = req.body.coverSpineStart ?? book.coverSpineStart;
    const coverSpineEnd = req.body.coverSpineEnd ?? book.coverSpineEnd;
    if (!['SINGLE','SPREAD'].includes(coverLayout) || !['LEFT','RIGHT'].includes(coverFrontSide) ||
      ![coverSpineStart,coverSpineEnd].every(value => typeof value === 'number' && Number.isFinite(value)) ||
      coverSpineStart < 20 || coverSpineEnd > 80 || coverSpineStart > coverSpineEnd || coverSpineEnd - coverSpineStart > 20) {
      throw new HttpError(400, 'جهت جلد و مرزهای عطف معتبر نیست. هر طرف تصویر باید حداقل ۲۰ درصد عرض داشته باشد.');
    }
    if (!['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'].includes(status) || !['sand', 'blue', 'moss', 'rose', 'ink'].includes(coverTone)) throw new HttpError(400, 'وضعیت یا رنگ جلد معتبر نیست.');
    const categoryId=req.body.categoryId===undefined?book.categoryId:req.body.categoryId?positiveId(req.body.categoryId):null;
    const categoryNode=categoryId?await prisma.bookCategory.findUnique({where:{id:categoryId}}):null;
    if(categoryId&&!categoryNode)throw new HttpError(400,'دسته پیدا نشد.');
    const categoryName=categoryNode?.name||text(category,80,true),tags=typeof req.body.tags==='string'?text(req.body.tags,600):'';
    if (status === 'PUBLISHED' && !book.pages.length) throw new HttpError(400, 'قبل از انتشار، حداقل یک صفحه به کتاب اضافه کنید.');
    const updated = await prisma.libraryBook.update({ where: { id }, data: {
      title: text(title, 200, true), author: text(author, 160), description: text(description, 3000), category:categoryName,categoryId,tags,catalogText:normalizePersian(title+' '+author+' '+categoryName+' '+tags),
      coverTone, language: text(language, 20, true), status, coverAssetId: await asset(coverAssetId, 'cover'),
      coverLayout, coverFrontSide, coverSpineStart, coverSpineEnd,
    }, include: { _count: { select: { pages: true } } } });
    res.json({ book: bookJson(updated) });
  } catch (error) { next(error); }
}
export async function savePage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const bookId = positiveId(req.params.id), number = positiveId(req.params.page);
    if (number > 100_000) throw new HttpError(400, 'شمارهٔ صفحه معتبر نیست.');
    const book=await prisma.libraryBook.findUnique({where:{id:bookId}});
    if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');
    if(req.method==='GET'){const page=await prisma.libraryPage.findUnique({where:{bookId_number:{bookId,number}}});if(!page)throw new HttpError(404,'صفحه پیدا نشد.');res.json({page:pageJson(page)});return;}
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

export async function changeBookState(req:AuthRequest,res:Response,next:NextFunction){try{
  const id=positiveId(req.params.id),book=await prisma.libraryBook.findUnique({where:{id},include:{_count:{select:{pages:true}}}});
  if(!book)throw new HttpError(404,'کتاب پیدا نشد.');
  const action=String(req.body.action),states:Record<string,string>={hide:'HIDDEN',archive:'ARCHIVED',trash:'TRASH',restore:'HIDDEN',publish:'PUBLISHED',draft:'DRAFT'};
  if(!states[action]||(book.status==='TRASH'&&action!=='restore')||(action==='restore'&&book.status!=='TRASH'))throw new HttpError(400,'این تغییر وضعیت مجاز نیست.');
  if(action==='publish'&&!book._count.pages)throw new HttpError(400,'قبل از انتشار حداقل یک صفحه اضافه کنید.');
  const updated=await prisma.libraryBook.update({where:{id},data:{status:states[action],deletedAt:action==='trash'?new Date():null},include:{_count:{select:{pages:true}}}});
  if(action==='trash')await prisma.bookImport.updateMany({where:{bookId:id,status:{in:['QUEUED','PROCESSING']}},data:{status:'CANCELED'}});
  res.json({book:bookJson(updated)});
}catch(e){next(e);}}
