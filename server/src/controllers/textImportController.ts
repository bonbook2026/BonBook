import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import {Response,NextFunction} from 'express';
import prisma from '../lib/prisma';
import {AuthRequest} from '../middleware/auth';
import {HttpError} from '../lib/httpError';
import {positiveId} from './libraryController';
import {normalizePersian} from '../services/searchService';
import {decodePageText,parseNumberedTexts,planTextChanges,textChangeSummary,textPageHash,TextChange} from '../services/pageTextImport';

const summarize=(job:any,includeItems=true)=>({id:job.id,bookId:job.bookId,sourceNames:JSON.parse(job.sourceNames),pageOffset:job.pageOffset,status:job.status,createdAt:job.createdAt,appliedAt:job.appliedAt,...(includeItems?{items:(JSON.parse(job.items) as TextChange[]).map(textChangeSummary)}:{})});
async function requireBook(bookId:number,tx:any=prisma){const book=await tx.libraryBook.findUnique({where:{id:bookId}});if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');return book;}
async function importForBook(bookId:number,id:string,tx:any=prisma){await requireBook(bookId,tx);const job=await tx.bookTextImport.findFirst({where:{id,bookId}});if(!job)throw new HttpError(404,'پیش‌نمایش متن پیدا نشد.');return job;}
export async function previewPageTexts(req:AuthRequest,res:Response,next:NextFunction){
 const files=(req.files||[]) as Express.Multer.File[];
 try{
  const bookId=positiveId(req.params.id);await requireBook(bookId);
  const offset=Number(req.body.pageOffset??0);if(!Number.isSafeInteger(offset)||Math.abs(offset)>10000)throw new HttpError(400,'اختلاف شمارهٔ صفحه معتبر نیست.');
  if(!files.length||files.reduce((sum,file)=>sum+file.size,0)>8*1024*1024)throw new HttpError(400,'یک فایل کامل یا فایل‌های صفحه با مجموع حداکثر ۸ مگابایت انتخاب کنید.');
  const sources=[];
  for(const file of files){
   if(!/\.(txt|md)$/i.test(file.originalname))throw new HttpError(400,'برای متن آماده، فایل TXT یا MD انتخاب کنید. تصویر PDF را از بخش ورود کتاب وارد کنید.');
   const raw=path.basename(file.originalname),decoded=/^[\x00-\xff]*$/.test(raw)?Buffer.from(raw,'latin1').toString('utf8'):raw;
   sources.push({name:(decoded.includes('\ufffd')?raw:decoded).slice(0,200),text:decodePageText(await fs.readFile(file.path))});
  }
  const parsed=parseNumberedTexts(sources),pages=await prisma.libraryPage.findMany({where:{bookId,number:{in:parsed.map(p=>p.number+offset)}}});
  const items=JSON.stringify(planTextChanges(parsed,pages,offset));if(Buffer.byteLength(items)>24*1024*1024)throw new HttpError(400,'مجموع متن‌های قبل و بعد زیاد است؛ فایل را به چند بخش تقسیم کنید.');
  const job=await prisma.bookTextImport.create({data:{id:crypto.randomUUID(),bookId,sourceNames:JSON.stringify(sources.map(f=>f.name)),pageOffset:offset,items,createdById:req.userId!}});
  res.status(201).json({import:summarize(job)});
 }catch(e){next(e);}finally{for(const file of files)await fs.unlink(file.path).catch(()=>{});}
}
export async function listPageTexts(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id);await requireBook(bookId);
 const jobs=await prisma.bookTextImport.findMany({where:{bookId},orderBy:{createdAt:'desc'},take:10,select:{id:true,bookId:true,sourceNames:true,pageOffset:true,status:true,createdAt:true,appliedAt:true}});
 res.json({imports:jobs.map(job=>summarize(job,false))});
}catch(e){next(e);}}
export async function getPageTexts(req:AuthRequest,res:Response,next:NextFunction){try{
 const job=await importForBook(positiveId(req.params.id),String(req.params.textImportId));
 if(req.params.sourcePage){const item=(JSON.parse(job.items) as TextChange[]).find(p=>p.sourceNumber===positiveId(req.params.sourcePage));if(!item)throw new HttpError(404,'صفحه در فایل متن پیدا نشد.');res.json({item:{...textChangeSummary(item),beforeContent:item.beforeContent,content:item.content,beforeCues:JSON.parse(item.beforeCues),cues:JSON.parse(item.cues)}});return;}
 res.json({import:summarize(job)});
}catch(e){next(e);}}
export async function applyPageTexts(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id),id=String(req.params.textImportId);
 const numbers=req.body.pages;if(!Array.isArray(numbers)||!numbers.length||numbers.length>2000||numbers.some(n=>!Number.isSafeInteger(n)||n<1)||new Set(numbers).size!==numbers.length)throw new HttpError(400,'صفحه‌های انتخاب‌شده معتبر نیستند.');
 const result=await prisma.$transaction(async tx=>{
  const job=await importForBook(bookId,id,tx);if(job.status!=='PREVIEW')throw new HttpError(409,'این پیش‌نمایش قبلاً ثبت یا بازگردانی شده است.');
  const items=JSON.parse(job.items) as TextChange[],selected=new Set<number>(numbers),changes=items.filter(item=>selected.has(item.sourceNumber));
  if(changes.length!==selected.size||changes.some(item=>!textChangeSummary(item).canApply))throw new HttpError(400,'صفحهٔ خالی، ناموجود یا بدون تغییر قابل جایگزینی نیست.');
  for(const item of changes){const page=await tx.libraryPage.findUnique({where:{id:item.pageId!}});if(!page||textPageHash(page)!==item.beforeHash)throw new HttpError(409,`صفحهٔ ${item.number} پس از پیش‌نمایش تغییر کرده است؛ دوباره پیش‌نمایش بگیرید. هیچ متنی ثبت نشد.`);}
  for(const item of changes){
   const page=await tx.libraryPage.findUniqueOrThrow({where:{id:item.pageId!}});
   await tx.libraryPage.update({where:{id:page.id},data:{content:item.content,audioCues:item.cues,audioCueMode:item.mode,searchText:normalizePersian(page.heading+' '+page.keywords+' '+item.content)}});
   await tx.audioAlignment.updateMany({where:{pageId:page.id,status:{in:['QUEUED','PROCESSING']}},data:{status:'CANCELED',warning:'متن آماده جایگزین شد؛ زمان‌بندی قبلی حفظ و محل متن بازتطبیق شد.'}});
   item.applied=true;
  }
  const updated=await tx.bookTextImport.update({where:{id},data:{items:JSON.stringify(items),status:'APPLIED',appliedAt:new Date()}});
  await tx.libraryBook.update({where:{id:bookId},data:{updatedAt:new Date()}});
  return {import:summarize(updated),updated:changes.length};
 },{timeout:30000});res.json(result);
}catch(e){next(e);}}
export async function undoPageTexts(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id),id=String(req.params.textImportId);
 const result=await prisma.$transaction(async tx=>{
  const job=await importForBook(bookId,id,tx);if(job.status!=='APPLIED')throw new HttpError(409,'فقط جایگزینی ثبت‌شده قابل بازگردانی است.');
  const items=JSON.parse(job.items) as TextChange[],changes=items.filter(item=>item.applied);
  for(const item of changes){const page=await tx.libraryPage.findUnique({where:{id:item.pageId!}});if(!page||textPageHash(page)!==item.afterHash)throw new HttpError(409,`صفحهٔ ${item.number} بعداً ویرایش شده است؛ بازگردانی دسته‌ای متوقف شد تا ویرایش تازه از بین نرود.`);}
  for(const item of changes){
   const page=await tx.libraryPage.findUniqueOrThrow({where:{id:item.pageId!}});
   await tx.libraryPage.update({where:{id:page.id},data:{content:item.beforeContent,audioCues:item.beforeCues,audioCueMode:item.beforeMode,searchText:normalizePersian(page.heading+' '+page.keywords+' '+item.beforeContent)}});
   await tx.audioAlignment.updateMany({where:{pageId:page.id,status:{in:['QUEUED','PROCESSING']}},data:{status:'CANCELED',warning:'متن به نسخهٔ قبل بازگردانده شد.'}});
  }
  const updated=await tx.bookTextImport.update({where:{id},data:{status:'UNDONE'}});await tx.libraryBook.update({where:{id:bookId},data:{updatedAt:new Date()}});
  return {import:summarize(updated),restored:changes.length};
 },{timeout:30000});res.json(result);
}catch(e){next(e);}}
