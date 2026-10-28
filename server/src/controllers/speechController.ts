import {Response,NextFunction} from 'express';
import prisma from '../lib/prisma';
import {AuthRequest} from '../middleware/auth';
import {HttpError} from '../lib/httpError';
import {positiveId} from './libraryController';
import {alignmentJson,queueAlignment,applyAlignment,speechAvailable} from '../services/speechService';
export async function pageAlignment(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id),number=positiveId(req.params.page),page=await prisma.libraryPage.findFirst({where:{bookId,number,book:{status:{not:'TRASH'}}}});if(!page)throw new HttpError(404,'صفحه در دسترس نیست.');
 if(req.method==='GET'){const job=await prisma.audioAlignment.findFirst({where:{pageId:page.id,audioAssetId:page.audioAssetId||''},orderBy:{createdAt:'desc'}});res.json({available:await speechAvailable(),alignment:job?alignmentJson(job):null});return;}
 if(!await speechAvailable())throw new HttpError(503,'موتور تشخیص گفتار روی سرور در حال آماده‌سازی است.');
 const job=await prisma.$transaction(tx=>queueAlignment(tx,page,req.userId!));res.status(202).json({alignment:alignmentJson(job)});
}catch(e){next(e);}}
export async function changeAlignment(req:AuthRequest,res:Response,next:NextFunction){try{
 const id=String(req.params.alignmentId),job=await prisma.audioAlignment.findUnique({where:{id},include:{page:{include:{book:true}}}});if(!job||job.page.book.status==='TRASH')throw new HttpError(404,'پردازش پیدا نشد.');
 if(req.method==='DELETE'){if(job.status==='APPLIED')throw new HttpError(409,'این زمان‌بندی اعمال شده است؛ آن را از ویرایشگر اصلاح کنید.');await prisma.audioAlignment.update({where:{id},data:{status:'CANCELED'}});res.json({ok:true});return;}
 if(req.method==='GET'){res.json({alignment:alignmentJson(job)});return;}
 const applied=await applyAlignment(id,req.body.replaceManual===true);res.json({alignment:alignmentJson(applied)});
}catch(e){next(e);}}
export async function alignBook(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id);if(!await speechAvailable())throw new HttpError(503,'موتور تشخیص گفتار آماده نیست.');
 if(!await prisma.libraryBook.findFirst({where:{id:bookId,status:{not:'TRASH'}}}))throw new HttpError(404,'کتاب در دسترس نیست.');
 const pages=await prisma.libraryPage.findMany({where:{bookId,audioAssetId:{not:null}},orderBy:{number:'asc'}});let queued=0,skipped=0;
 for(const page of pages){if(!page.content.trim()||(page.audioCues!=='[]'&&req.body.replaceExisting!==true)){skipped++;continue;}await prisma.$transaction(tx=>queueAlignment(tx,page,req.userId!));queued++;}
 res.status(202).json({queued,skipped});
}catch(e){next(e);}}
export async function bookAlignments(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id);if(!await prisma.libraryBook.findFirst({where:{id:bookId,status:{not:'TRASH'}}}))throw new HttpError(404,'کتاب در دسترس نیست.');
 const jobs=await prisma.audioAlignment.findMany({where:{page:{bookId}},orderBy:{createdAt:'desc'},select:{id:true,status:true,progress:true,coverage:true,lineCoverage:true,warning:true,error:true,candidates:true,pageId:true,page:{select:{number:true}}},take:4000});
 const seen=new Set<number>(),latest=jobs.filter(job=>{if(seen.has(job.pageId))return false;seen.add(job.pageId);return true;});
 if(req.method==='GET'){res.json({jobs:latest.map(job=>({...job,page:undefined,pageNumber:job.page.number,candidates:JSON.parse(job.candidates)}))});return;}
 let applied=0,skipped=0;for(const job of latest){if(job.status!=='READY'||job.coverage<.78||job.lineCoverage!==1)continue;try{await applyAlignment(job.id);applied++;}catch{skipped++;}}
 res.json({applied,skipped});
}catch(e){next(e);}}
