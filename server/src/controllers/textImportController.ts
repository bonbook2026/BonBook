import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import {Response,NextFunction} from 'express';
import {Prisma} from '@prisma/client';
import prisma from '../lib/prisma';
import {AuthRequest} from '../middleware/auth';
import {HttpError} from '../lib/httpError';
import {positiveId} from './libraryController';
import {normalizePersian} from '../services/searchService';
import {decodePageText,parseNumberedTexts,planTextChanges,planTextFilterChanges,textChangeSummary,textPageHash,TextChange} from '../services/pageTextImport';
import {bookTextFilters,filterNarrationText,textFilterKey,textFilterSignature,validateTextFilters} from '../services/textFilters';

const summarize=(job:any,includeItems=true)=>({id:job.id,bookId:job.bookId,sourceNames:JSON.parse(job.sourceNames),pageOffset:job.pageOffset,status:job.status,createdAt:job.createdAt,appliedAt:job.appliedAt,...(includeItems?{items:(JSON.parse(job.items) as TextChange[]).map(textChangeSummary)}:{})});
async function requireBook(bookId:number,tx:any=prisma){const book=await tx.libraryBook.findUnique({where:{id:bookId}});if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');return book;}
async function importForBook(bookId:number,id:string,tx:any=prisma){await requireBook(bookId,tx);const job=await tx.bookTextImport.findFirst({where:{id,bookId}});if(!job)throw new HttpError(404,'پیش‌نمایش متن پیدا نشد.');return job;}
async function currentPages(tx:any,changes:TextChange[]){
 const result=new Map<number,any>();
 for(let start=0;start<changes.length;start+=400)for(const page of await tx.libraryPage.findMany({where:{id:{in:changes.slice(start,start+400).map(item=>item.pageId!)}}}))result.set(page.id,page);
 return result;
}
async function writeTextChanges(tx:any,changes:TextChange[],pages:Map<number,any>,undo=false){
 // Bound statements below SQLite's 999-parameter floor. Hundreds of per-row
 // round trips can starve other connections while an interactive transaction is open.
 for(let start=0;start<changes.length;start+=75){
  const chunk=changes.slice(start,start+75),values=chunk.map(item=>{const page=pages.get(item.pageId!)!,content=undo?item.beforeContent:item.content;return {id:page.id,content,cues:undo?item.beforeCues:item.cues,mode:undo?item.beforeMode:item.mode,search:normalizePersian(page.heading+' '+page.keywords+' '+content)};});
  await tx.$executeRaw(Prisma.sql`UPDATE library_pages SET
   content = CASE id ${Prisma.join(values.map(v=>Prisma.sql`WHEN ${v.id} THEN ${v.content}`),' ')} END,
   search_text = CASE id ${Prisma.join(values.map(v=>Prisma.sql`WHEN ${v.id} THEN ${v.search}`),' ')} END,
   audio_cues = CASE id ${Prisma.join(values.map(v=>Prisma.sql`WHEN ${v.id} THEN ${v.cues}`),' ')} END,
   audio_cue_mode = CASE id ${Prisma.join(values.map(v=>Prisma.sql`WHEN ${v.id} THEN ${v.mode}`),' ')} END,
   updated_at = ${Date.now()} WHERE id IN (${Prisma.join(values.map(v=>v.id))})`);
  await tx.audioAlignment.updateMany({where:{pageId:{in:values.map(v=>v.id)},status:{in:['QUEUED','PROCESSING']}},data:{status:'CANCELED',warning:undo?'متن به نسخهٔ قبل بازگردانده شد.':'متن آماده جایگزین شد؛ زمان‌بندی قبلی حفظ و محل متن بازتطبیق شد.'}});
 }
}
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
  const phrases=await bookTextFilters(prisma,bookId),signature=textFilterSignature(phrases),parsed=parseNumberedTexts(sources,phrases),pages=await prisma.libraryPage.findMany({where:{bookId,number:{in:parsed.map(p=>p.number+offset)}}});
  const items=JSON.stringify(planTextChanges(parsed,pages,offset).map(item=>({...item,filterSignature:signature})));if(Buffer.byteLength(items)>24*1024*1024)throw new HttpError(400,'مجموع متن‌های قبل و بعد زیاد است؛ فایل را به چند بخش تقسیم کنید.');
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
 if(req.params.sourcePage){const item=(JSON.parse(job.items) as TextChange[]).find(p=>p.sourceNumber===positiveId(req.params.sourcePage));if(!item)throw new HttpError(404,'صفحه در فایل متن پیدا نشد.');const phrases=await bookTextFilters(prisma,job.bookId),content=filterNarrationText(item.content,phrases).content;res.json({item:{...textChangeSummary(item),newLength:content.length,beforeContent:item.beforeContent,content,beforeCues:JSON.parse(item.beforeCues),cues:JSON.parse(item.cues)}});return;}
 res.json({import:summarize(job)});
}catch(e){next(e);}}
export async function applyPageTexts(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id),id=String(req.params.textImportId);
 const numbers=req.body.pages;if(!Array.isArray(numbers)||!numbers.length||numbers.length>2000||numbers.some(n=>!Number.isSafeInteger(n)||n<1)||new Set(numbers).size!==numbers.length)throw new HttpError(400,'صفحه‌های انتخاب‌شده معتبر نیستند.');
 const result=await prisma.$transaction(async tx=>{
  const job=await importForBook(bookId,id,tx);if(job.status!=='PREVIEW')throw new HttpError(409,'این پیش‌نمایش قبلاً ثبت یا بازگردانی شده است.');
  const items=JSON.parse(job.items) as TextChange[],selected=new Set<number>(numbers),changes=items.filter(item=>selected.has(item.sourceNumber));
  if(changes.length!==selected.size||changes.some(item=>!textChangeSummary(item).canApply))throw new HttpError(400,'صفحهٔ خالی، ناموجود یا بدون تغییر قابل جایگزینی نیست.');
  const phrases=await bookTextFilters(tx,bookId),signature=textFilterSignature(phrases);
  if(changes.some(item=>(item.filterSignature&&item.filterSignature!==signature)||filterNarrationText(item.content,phrases).removedCount))throw new HttpError(409,'فیلتر متن تغییر کرده یا این پیش‌نمایش قدیمی شامل عبارت فیلترشده است؛ دوباره پیش‌نمایش بگیرید.');
  const pages=await currentPages(tx,changes);
  for(const item of changes){const page=pages.get(item.pageId!);if(!page||textPageHash(page)!==item.beforeHash)throw new HttpError(409,`صفحهٔ ${item.number} پس از پیش‌نمایش تغییر کرده است؛ دوباره پیش‌نمایش بگیرید. هیچ متنی ثبت نشد.`);}
  await writeTextChanges(tx,changes,pages);for(const item of changes)item.applied=true;
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
  const phrases=await bookTextFilters(tx,bookId);
  if(changes.some(item=>filterNarrationText(item.beforeContent,phrases).removedCount))throw new HttpError(409,'نسخهٔ قبلی شامل عبارت‌هایی است که اکنون فیلتر کرده‌اید. برای بازگرداندن آن عبارت‌ها، ابتدا فیلتر مربوط را بردارید و ذخیره کنید.');
  const pages=await currentPages(tx,changes);
  for(const item of changes){const page=pages.get(item.pageId!);if(!page||textPageHash(page)!==item.afterHash)throw new HttpError(409,`صفحهٔ ${item.number} بعداً ویرایش شده است؛ بازگردانی دسته‌ای متوقف شد تا ویرایش تازه از بین نرود.`);}
  await writeTextChanges(tx,changes,pages,true);
  const updated=await tx.bookTextImport.update({where:{id},data:{status:'UNDONE'}});await tx.libraryBook.update({where:{id:bookId},data:{updatedAt:new Date()}});
  return {import:summarize(updated),restored:changes.length};
 },{timeout:30000});res.json(result);
}catch(e){next(e);}}

export async function textFilterSettings(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id);await requireBook(bookId);
 if(req.method==='GET'){res.json({phrases:await bookTextFilters(prisma,bookId)});return;}
 const phrases=validateTextFilters(req.body.phrases);await prisma.siteSetting.upsert({where:{key:textFilterKey(bookId)},create:{key:textFilterKey(bookId),value:JSON.stringify(phrases)},update:{value:JSON.stringify(phrases)}});res.json({phrases});
}catch(e){next(e);}}
export async function previewTextFilterCleanup(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id);await requireBook(bookId);const phrases=await bookTextFilters(prisma,bookId),pages=await prisma.libraryPage.findMany({where:{bookId},orderBy:{number:'asc'}}),changes=planTextFilterChanges(pages,phrases);
 if(changes.length>2000)throw new HttpError(400,'در هر نوبت حداکثر ۲۰۰۰ صفحه پاک‌سازی کنید.');
 if(!changes.length){res.json({import:null,removedCount:0});return;}
 const items=JSON.stringify(changes);if(Buffer.byteLength(items)>24*1024*1024)throw new HttpError(400,'مجموع متن‌ها زیاد است؛ پاک‌سازی را از ورود متن در چند نوبت انجام دهید.');
 const job=await prisma.bookTextImport.create({data:{id:crypto.randomUUID(),bookId,sourceNames:JSON.stringify(['پاک‌سازی عبارت‌های فیلترشده']),items,createdById:req.userId!}});
 res.status(201).json({import:summarize(job),removedCount:changes.reduce((sum,item)=>sum+(item.removedCount||0),0)});
}catch(e){next(e);}}
