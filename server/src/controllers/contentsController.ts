import {Response,NextFunction} from 'express';
import prisma from '../lib/prisma';
import {AuthRequest} from '../middleware/auth';
import {HttpError} from '../lib/httpError';
import {positiveId} from './libraryController';
import {parseContents} from '../services/contentsService';

export async function bookContents(req:AuthRequest,res:Response,next:NextFunction){try{
  const bookId=positiveId(req.params.id),book=await prisma.libraryBook.findUnique({where:{id:bookId}});
  if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');
  if(req.method==='GET'){res.json({contents:await prisma.bookContents.findMany({where:{bookId},orderBy:{position:'asc'}})});return;}
  const entries=req.body.contents;
  if(!Array.isArray(entries)||entries.length>2000)throw new HttpError(400,'فهرست باید حداکثر ۲۰۰۰ عنوان داشته باشد.');
  await prisma.$transaction(async tx=>{
    const pages=new Set((await tx.libraryPage.findMany({where:{bookId},select:{number:true}})).map(page=>page.number));
    const data=entries.map((entry:any,position:number)=>{
      if(typeof entry?.title!=='string'||!entry.title.trim()||entry.title.length>200||!Number.isSafeInteger(entry.pageNumber)||!pages.has(entry.pageNumber)||!Number.isInteger(entry.level)||entry.level<0||entry.level>4)throw new HttpError(400,'عنوان، سطح و صفحهٔ مقصد را بررسی کنید؛ صفحهٔ مقصد باید در کتاب وجود داشته باشد.');
      return {bookId,title:entry.title.trim(),pageNumber:entry.pageNumber,level:entry.level,position};
    });
    await tx.bookContents.deleteMany({where:{bookId}});
    for(const entry of data)await tx.bookContents.create({data:entry});
    await tx.libraryBook.update({where:{id:bookId},data:{updatedAt:new Date()}});
  },{timeout:30000});
  res.json({contents:await prisma.bookContents.findMany({where:{bookId},orderBy:{position:'asc'}})});
}catch(error){next(error);}}

export async function suggestContents(req:AuthRequest,res:Response,next:NextFunction){try{
  const bookId=positiveId(req.params.id),from=positiveId(req.body.from||1),to=positiveId(req.body.to||10);
  if(to<from||to-from>39)throw new HttpError(400,'حداکثر ۴۰ صفحهٔ فهرست را انتخاب کنید.');
  if(!await prisma.libraryBook.findFirst({where:{id:bookId,status:{not:'TRASH'}}}))throw new HttpError(404,'کتاب در دسترس نیست.');
  const pages=await prisma.libraryPage.findMany({where:{bookId,number:{gte:from,lte:to}},orderBy:{number:'asc'},select:{content:true}});
  res.json({contents:parseContents(pages.map(page=>page.content).join('\n')),warning:'پیشنهادها ذخیره نشده‌اند. شماره‌ها و عنوان‌های OCR را با فایل اصلی بررسی کنید.'});
}catch(error){next(error);}}
