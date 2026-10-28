import {Response,NextFunction} from 'express';
import prisma from '../lib/prisma';
import {AuthRequest} from '../middleware/auth';
import {HttpError} from '../lib/httpError';
import {positiveId} from './libraryController';
import {normalizePersian} from '../services/searchService';

export async function categories(req:AuthRequest,res:Response,next:NextFunction){try{
  if(req.method==='GET'){
    const rows=await prisma.bookCategory.findMany({orderBy:{name:'asc'},include:{_count:{select:{books:true}}}});
    const trail=(id:number,seen:number[]=[]):string=>{const category=rows.find(row=>row.id===id);return !category||seen.includes(id)?'':(category.parentId?trail(category.parentId,[...seen,id])+' / ':'')+category.name;};
    res.json({categories:rows.map(row=>({...row,path:trail(row.id),bookCount:row._count.books}))});return;
  }
  if(req.method==='DELETE'){
    const id=positiveId(req.params.categoryId),used=await prisma.libraryBook.count({where:{categoryId:id}}),children=await prisma.bookCategory.count({where:{parentId:id}});
    if(used||children)throw new HttpError(409,'ابتدا کتاب‌ها و زیرگروه‌های این دسته را به دستهٔ دیگری منتقل کنید.');
    await prisma.bookCategory.delete({where:{id}});res.json({ok:true});return;
  }
  const name=typeof req.body.name==='string'?req.body.name.trim():'';
  if(!name||name.length>80)throw new HttpError(400,'نام دسته باید بین ۱ تا ۸۰ حرف باشد.');
  const parentId=req.body.parentId?positiveId(req.body.parentId):null,id=req.params.categoryId?positiveId(req.params.categoryId):null;
  if(parentId){let current:number|null=parentId,depth=0;while(current){if(current===id||depth++>5)throw new HttpError(400,'ساختار دسته‌ها چرخه دارد یا بیش از حد عمیق است.');const parent:{parentId:number|null}|null=await prisma.bookCategory.findUnique({where:{id:current},select:{parentId:true}});if(!parent)throw new HttpError(400,'دستهٔ بالاتر پیدا نشد.');current=parent.parentId;}}
  const key=(parentId||0)+':'+normalizePersian(name);
  if(await prisma.bookCategory.findFirst({where:{key,...(id?{id:{not:id}}:{})}}))throw new HttpError(409,'این دسته از قبل وجود دارد.');
  const category=id?await prisma.bookCategory.update({where:{id},data:{name,parentId,key}}):await prisma.bookCategory.create({data:{name,parentId,key}});
  if(id){const books=await prisma.libraryBook.findMany({where:{categoryId:id}});for(const book of books)await prisma.libraryBook.update({where:{id:book.id},data:{category:name,catalogText:normalizePersian(book.title+' '+book.author+' '+name+' '+book.tags)}});}
  res.json({category});
}catch(e){next(e);}}
