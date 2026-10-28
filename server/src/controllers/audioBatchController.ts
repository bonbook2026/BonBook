import {Response,NextFunction} from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import {AuthRequest} from '../middleware/auth';
import {config} from '../config';
import {HttpError} from '../lib/httpError';
import {positiveId} from './libraryController';
import {detectMedia} from '../services/mediaService';
import {queueAlignment,speechAvailable,alignmentJson} from '../services/speechService';
export async function audioOptions(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id);if(!await prisma.libraryBook.findFirst({where:{id:bookId,status:{not:'TRASH'}}}))throw new HttpError(404,'کتاب در دسترس نیست.');
 const pages=await prisma.libraryPage.findMany({where:{bookId},select:{number:true,heading:true,audioAssetId:true},orderBy:{number:'asc'}});
 res.json({pages,speech:await speechAvailable(),maxFileBytes:30*1024*1024,maxFiles:2000});
}catch(e){next(e);}}
export async function audioBatches(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id),book=await prisma.libraryBook.findUnique({where:{id:bookId}});if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');
 if(req.method==='GET'){res.json({batches:await prisma.audioBatch.findMany({where:{bookId},include:{items:true},orderBy:{createdAt:'desc'},take:5})});return;}
 const {files,replaceExisting=false,autoAlign=true}=req.body;
 if(!Array.isArray(files)||!files.length||files.length>2000||typeof replaceExisting!=='boolean'||typeof autoAlign!=='boolean')throw new HttpError(400,'از یک تا ۲۰۰۰ فایل صوتی انتخاب کنید.');
 const numbers=new Set<number>();for(const file of files){if(typeof file?.filename!=='string'||!file.filename.trim()||file.filename.length>500||!Number.isSafeInteger(file.pageNumber)||file.pageNumber<1||numbers.has(file.pageNumber)||!Number.isSafeInteger(file.size)||file.size<12||file.size>30*1024*1024)throw new HttpError(400,'نام فایل، شمارهٔ تکراری یا حجم فایل‌ها را بررسی کنید.');numbers.add(file.pageNumber);}
 const batch=await prisma.$transaction(async tx=>{
  const pages=await tx.libraryPage.findMany({where:{bookId,number:{in:[...numbers]}},select:{number:true,audioAssetId:true}}),byNumber=new Map(pages.map(page=>[page.number,page]));
  for(const file of files){const page=byNumber.get(file.pageNumber);if(!page)throw new HttpError(409,`صفحهٔ ${file.pageNumber} در کتاب وجود ندارد.`);if(page.audioAssetId&&!replaceExisting)throw new HttpError(409,`صفحهٔ ${file.pageNumber} قبلاً ویس دارد. گزینهٔ جایگزینی را صریحاً انتخاب کنید.`);}
  return tx.audioBatch.create({data:{id:crypto.randomUUID(),bookId,autoAlign,replaceExisting,createdById:req.userId!,items:{create:files.map(file=>({id:crypto.randomUUID(),pageNumber:file.pageNumber,filename:file.filename,size:file.size,expectedAssetId:byNumber.get(file.pageNumber)!.audioAssetId}))}},include:{items:true}});
 });res.status(201).json({batch});
}catch(e){next(e);}}
export async function getAudioBatch(req:AuthRequest,res:Response,next:NextFunction){try{
 const id=String(req.params.batchId),batch=await prisma.audioBatch.findUnique({where:{id},include:{items:true,book:true}});if(!batch||batch.book.status==='TRASH')throw new HttpError(404,'ورود گروهی پیدا نشد.');
 if(req.method==='DELETE'){
  await prisma.$transaction(async tx=>{await tx.audioBatch.update({where:{id},data:{status:'CANCELED'}});await tx.audioBatchItem.updateMany({where:{batchId:id,status:{in:['WAITING','FAILED']}},data:{status:'SKIPPED',error:'بارگذاری لغو شد.'}});});res.json({ok:true});return;
 }
 const assets=batch.items.map(item=>item.assetId).filter((id):id is string=>Boolean(id)),jobs=await prisma.audioAlignment.findMany({where:{audioAssetId:{in:assets},page:{bookId:batch.bookId}},orderBy:{createdAt:'desc'},select:{id:true,status:true,progress:true,coverage:true,lineCoverage:true,warning:true,error:true,candidates:true,page:{select:{number:true}}}});
 const latest=new Map<number,any>();for(const job of jobs)if(!latest.has(job.page.number))latest.set(job.page.number,{...job,page:undefined,candidates:JSON.parse(job.candidates)});
 res.json({batch:{...batch,book:undefined,items:batch.items.map(item=>({...item,alignment:latest.get(item.pageNumber)||null}))}});
}catch(e){next(e);}}
export async function uploadBatchAudio(req:AuthRequest,res:Response,next:NextFunction){
 let destination='';const file=req.file;
 try{
  if(!file)throw new HttpError(400,'فایل صوتی انتخاب نشده است.');
  const batchId=String(req.params.batchId),id=String(req.params.itemId),item=await prisma.audioBatchItem.findFirst({where:{id,batchId},include:{batch:{include:{book:true}}}});
  if(!item||item.batch.book.status==='TRASH'||item.batch.status==='CANCELED')throw new HttpError(404,'ورود گروهی در دسترس نیست.');
  if(item.status==='ATTACHED'){res.json({item});return;}
  if(file.size!==item.size)throw new HttpError(400,'اندازهٔ فایل با پیش‌نمایش مطابقت ندارد. همان پوشه را دوباره انتخاب کنید.');
  const handle=await fs.open(file.path,'r'),header=Buffer.alloc(32);try{await handle.read(header,0,32,0);}finally{await handle.close();}
  const detected=detectMedia(header,'audio'),assetId=crypto.randomUUID(),filename=assetId+'.'+detected.extension;
  await fs.mkdir(config.mediaDirectory,{recursive:true,mode:0o700});destination=path.join(config.mediaDirectory,filename);await fs.rename(file.path,destination);await fs.chmod(destination,0o600);
  const result=await prisma.$transaction(async tx=>{
   const current=await tx.audioBatchItem.findUnique({where:{id},include:{batch:{include:{book:true}}}});if(!current||current.batch.status==='CANCELED'||current.batch.book.status==='TRASH')throw new HttpError(409,'بارگذاری لغو شده است.');
   if(current.status==='ATTACHED')return {item:current,duplicate:true};
   const page=await tx.libraryPage.findUnique({where:{bookId_number:{bookId:item.batch.bookId,number:item.pageNumber}}});if(!page)throw new HttpError(409,'صفحهٔ مقصد حذف شده است.');
   if(page.audioAssetId!==current.expectedAssetId)throw new HttpError(409,'ویس صفحه پس از پیش‌نمایش تغییر کرده است. دوباره پیش‌نمایش بگیر.');
   await tx.mediaAsset.create({data:{id:assetId,filename,mimeType:detected.mimeType,kind:'audio',size:file.size,createdById:req.userId!}});
   const attached=await tx.libraryPage.update({where:{id:page.id},data:{audioAssetId:assetId,audioCues:'[]',audioCueMode:'NONE'}});
   await tx.audioAlignment.updateMany({where:{pageId:page.id,status:{in:['QUEUED','PROCESSING']}},data:{status:'CANCELED',warning:'ویس صفحه تعویض شد.'}});
   if(item.batch.autoAlign&&attached.content.trim())await queueAlignment(tx,attached,req.userId!);
   const updated=await tx.audioBatchItem.update({where:{id},data:{assetId,status:'ATTACHED',error:null}});
   if(!await tx.audioBatchItem.count({where:{batchId,status:{not:'ATTACHED'}}}))await tx.audioBatch.update({where:{id:batchId},data:{status:'COMPLETE'}});
   return {item:updated,duplicate:false};
  });
  if(result.duplicate)await fs.unlink(destination);destination='';res.json({item:result.item});
 }catch(e){if(destination)await fs.unlink(destination).catch(()=>{});const id=String(req.params.itemId);await prisma.audioBatchItem.updateMany({where:{id,status:{in:['WAITING','FAILED']}},data:{status:'FAILED',error:e instanceof HttpError?e.message:'بارگذاری کامل نشد؛ دوباره تلاش کنید.'}}).catch(()=>{});next(e);}
 finally{if(file)await fs.unlink(file.path).catch(()=>{});}
}
