import {Response,NextFunction} from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import {AuthRequest} from '../middleware/auth';
import {HttpError} from '../lib/httpError';
import {config} from '../config';
import {positiveId} from './libraryController';
import {ImportSource,ocrAvailable,cleanText} from '../services/documentExtraction';
import {normalizePersian} from '../services/searchService';

const types:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',odt:'application/vnd.oasis.opendocument.text',epub:'application/epub+zip',txt:'text/plain',md:'text/plain',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',tif:'image/tiff',tiff:'image/tiff',bmp:'image/bmp'};
export const importJson=(job:any)=>({id:job.id,bookId:job.bookId,filename:job.filename,format:job.format,mode:job.mode,status:job.status,totalPages:job.totalPages,completedPages:job.completedPages,warnings:job.warnings,error:job.error,createdAt:job.createdAt});
export async function importOptions(_req:AuthRequest,res:Response,next:NextFunction){try{res.json({ocr:await ocrAvailable(),maxBytes:30*1024*1024,formats:Object.keys(types)});}catch(e){next(e);}}
export async function uploadDocument(req:AuthRequest,res:Response,next:NextFunction){
  const files=(req.files||[]) as Express.Multer.File[],created:string[]=[];
  try{
    const bookId=positiveId(req.params.id),book=await prisma.libraryBook.findUnique({where:{id:bookId}});
    if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');
    if(!files.length||files.reduce((sum,file)=>sum+file.size,0)>30*1024*1024)throw new HttpError(400,'یک فایل کتاب یا مجموعه عکس با مجموع حجم حداکثر ۳۰ مگابایت انتخاب کنید.');
    if(await prisma.bookImport.findFirst({where:{bookId,status:{in:['QUEUED','PROCESSING']}}}))throw new HttpError(409,'پردازش دیگری برای این کتاب در جریان است.');
    const mode=String(req.body.mode||'auto');if(!['auto','text','ocr','images'].includes(mode))throw new HttpError(400,'روش استخراج معتبر نیست.');
    if(mode==='images'&&files.some(file=>!/\.(pdf|jpe?g|png|webp|tiff?|bmp)$/i.test(file.originalname)))throw new HttpError(400,'ورود بدون OCR مخصوص PDF یا عکس صفحه‌ها است.');
    await fs.mkdir(config.mediaDirectory,{recursive:true,mode:0o700});
    const sources:ImportSource[]=[];
    for(const file of files){
      const format=path.extname(file.originalname).slice(1).toLowerCase(),mimeType=types[format];if(!mimeType)throw new HttpError(400,'قالب فایل پشتیبانی نمی‌شود. Word را با پسوند DOCX ذخیره کنید.');
      const handle=await fs.open(file.path,'r'),header=Buffer.alloc(16);try{await handle.read(header,0,16,0);}finally{await handle.close();}
      const signature=format==='pdf'?header.subarray(0,5).toString()==='%PDF-':['docx','odt','epub'].includes(format)?header[0]===80&&header[1]===75:['jpg','jpeg'].includes(format)?header[0]===255&&header[1]===216:format==='png'?header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):format==='webp'?header.toString('ascii',0,4)==='RIFF'&&header.toString('ascii',8,12)==='WEBP':['tif','tiff'].includes(format)?['II','MM'].includes(header.toString('ascii',0,2)):format==='bmp'?header.toString('ascii',0,2)==='BM':true;
      if(!signature)throw new HttpError(400,'محتوای فایل با پسوند آن مطابقت ندارد.');
      if(files.length>1&&!mimeType.startsWith('image/'))throw new HttpError(400,'چند فایل را فقط برای عکس‌های صفحه‌ها انتخاب کنید. PDF و Word را جدا وارد کنید.');
      const id=crypto.randomUUID(),filename=id+'.'+format,destination=path.join(config.mediaDirectory,filename);
      await fs.rename(file.path,destination);created.push(destination);await fs.chmod(destination,0o600);
      const rawName=path.basename(file.originalname),decoded=/^[\x00-\xff]*$/.test(rawName)?Buffer.from(rawName,'latin1').toString('utf8'):rawName;
      sources.push({id,filename,name:(decoded.includes('\ufffd')?rawName:decoded).slice(0,200),format,mimeType,language:book.language});
    }
    const job=await prisma.$transaction(async tx=>{
      for(let i=0;i<sources.length;i++)await tx.mediaAsset.create({data:{id:sources[i].id,filename:sources[i].filename,mimeType:sources[i].mimeType,kind:'document',size:files[i].size,createdById:req.userId!}});
      return tx.bookImport.create({data:{id:crypto.randomUUID(),bookId,sourceAssetId:sources[0].id,filename:sources.length>1?`${sources.length} تصویر صفحه`:sources[0].name,format:sources.length>1?'images':sources[0].format,sources:JSON.stringify(sources),mode,createdById:req.userId!}});
    });
    res.status(202).json({import:importJson(job)});
  }catch(error){for(const file of created)await fs.unlink(file).catch(()=>{});next(error);}
  finally{for(const file of files)await fs.unlink(file.path).catch(()=>{});}
}
export async function bookImports(req:AuthRequest,res:Response,next:NextFunction){try{const jobs=await prisma.bookImport.findMany({where:{bookId:positiveId(req.params.id)},orderBy:{createdAt:'desc'},take:10});res.json({imports:jobs.map(importJson)});}catch(e){next(e);}}
export async function getImport(req:AuthRequest,res:Response,next:NextFunction){try{
  const job=await prisma.bookImport.findUnique({where:{id:String(req.params.importId)}});if(!job)throw new HttpError(404,'پردازش پیدا نشد.');
  if(req.method==='DELETE'){
    if(job.status==='APPLIED')throw new HttpError(409,'این ورود قبلاً ثبت شده است. صفحه‌ها را در کتاب ویرایش کنید.');
    await prisma.bookImport.update({where:{id:job.id},data:{status:'CANCELED'}});res.json({ok:true});return;
  }
  res.json({import:importJson(job)});
}catch(e){next(e);}}
export async function importedPage(req:AuthRequest,res:Response,next:NextFunction){try{
  const importId=String(req.params.importId),number=positiveId(req.params.page),page=await prisma.importedPage.findUnique({where:{importId_number:{importId,number}}});
  if(!page)throw new HttpError(404,'این صفحه هنوز آماده نشده است.');
  if(req.method==='PUT'){
    const job=await prisma.bookImport.findUnique({where:{id:importId}});if(job?.status!=='REVIEW')throw new HttpError(409,'پس از پایان پردازش می‌توانید متن را اصلاح کنید.');
    if(typeof req.body.content!=='string'||req.body.content.length>40000||typeof req.body.heading!=='string'||req.body.heading.length>200)throw new HttpError(400,'متن صفحه معتبر نیست.');
    const updated=await prisma.importedPage.update({where:{id:page.id},data:{content:cleanText(req.body.content),heading:req.body.heading.trim()}});res.json({page:updated});return;
  }
  res.json({page:{...page,sourceUrl:page.sourceAssetId?`/api/media/${page.sourceAssetId}`:null}});
}catch(e){next(e);}}
export async function applyImport(req:AuthRequest,res:Response,next:NextFunction){try{
  const id=String(req.params.importId),start=positiveId(req.body.startPage||1);
  const result=await prisma.$transaction(async tx=>{
    const job=await tx.bookImport.findUnique({where:{id},include:{book:true,pages:{orderBy:{number:'asc'}}}});
    if(!job)throw new HttpError(404,'پردازش پیدا نشد.');if(job.status==='APPLIED')return {bookId:job.bookId,added:0};
    if(job.status!=='REVIEW'||job.book.status==='TRASH')throw new HttpError(409,'پردازش هنوز آمادهٔ ثبت نیست.');
    if(start+job.pages.length>100001)throw new HttpError(400,'شمارهٔ صفحه‌ها بیش از حد بزرگ است.');
    if(await tx.libraryPage.count({where:{bookId:job.bookId,number:{gte:start,lt:start+job.pages.length}}}))throw new HttpError(409,'این شمارهٔ صفحه‌ها قبلاً استفاده شده‌اند. شمارهٔ شروع را تغییر دهید.');
    for(const page of job.pages)await tx.libraryPage.create({data:{bookId:job.bookId,number:start+page.number-1,heading:page.heading,content:page.content,keywords:'',searchText:normalizePersian(page.heading+' '+page.content),sourceAssetId:page.sourceAssetId,sourcePageNumber:page.sourcePageNumber}});
    await tx.bookImport.update({where:{id},data:{status:'APPLIED'}});await tx.libraryBook.update({where:{id:job.bookId},data:{updatedAt:new Date(),isSample:false}});
    return {bookId:job.bookId,added:job.pages.length};
  },{timeout:30_000});res.json(result);
}catch(e){next(e);}}
