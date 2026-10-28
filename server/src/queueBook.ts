// Trusted server-side maintenance helper; never generates a login token.
import './config';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import prisma from './lib/prisma';
import {config} from './config';
import {normalizePersian} from './services/searchService';
async function main(){
  const settings=JSON.parse(await fs.readFile(process.argv[2],'utf8')) as {file:string;filename:string;title:string;author:string;category:string;parentCategory?:string;tags:string;coverSha256?:string};
  if(!settings.title||settings.title.length>200||path.extname(settings.file).toLowerCase()!=='.pdf')throw new Error('Valid title and PDF required.');
  const existing=await prisma.bookImport.findFirst({where:{filename:settings.filename,book:{title:settings.title},status:{in:['QUEUED','PROCESSING','REVIEW','APPLIED']}},orderBy:{createdAt:'desc'}});
  if(existing){console.log(JSON.stringify({bookId:existing.bookId,importId:existing.id,status:existing.status,reused:true}));return;}
  const owner=await prisma.user.findFirst({where:{role:'OWNER'},orderBy:{id:'asc'}});if(!owner)throw new Error('A verified owner must already exist.');
  const stat=await fs.stat(settings.file);if(stat.size>30*1024*1024)throw new Error('PDF is too large.');
  let parentId:number|null=null;
  if(settings.parentCategory){const name=settings.parentCategory,key='0:'+normalizePersian(name);parentId=(await prisma.bookCategory.upsert({where:{key},create:{name,key},update:{}})).id;}
  const key=(parentId||0)+':'+normalizePersian(settings.category),category=await prisma.bookCategory.upsert({where:{key},create:{key,parentId,name:settings.category},update:{}});
  let coverAssetId:string|null=null;
  if(settings.coverSha256){const covers=await prisma.mediaAsset.findMany({where:{kind:'cover'}});for(const cover of covers){const bytes=await fs.readFile(path.join(config.mediaDirectory,cover.filename));if(crypto.createHash('sha256').update(bytes).digest('hex')===settings.coverSha256.toLowerCase()){coverAssetId=cover.id;break;}}if(!coverAssetId)throw new Error('The supplied cover was not found in BonBook media.');}
  const sourceId=crypto.randomUUID(),filename=sourceId+'.pdf';await fs.copyFile(settings.file,path.join(config.mediaDirectory,filename));await fs.chmod(path.join(config.mediaDirectory,filename),0o600);
  const result=await prisma.$transaction(async tx=>{
    const book=await tx.libraryBook.create({data:{title:settings.title,author:settings.author,category:category.name,categoryId:category.id,tags:settings.tags,status:'DRAFT',createdById:owner.id,coverAssetId,coverLayout:coverAssetId?'SPREAD':'SINGLE',coverFrontSide:'LEFT',coverSpineStart:48,coverSpineEnd:52,catalogText:normalizePersian(settings.title+' '+settings.author+' '+settings.category+' '+settings.tags)}});
    await tx.mediaAsset.create({data:{id:sourceId,filename,mimeType:'application/pdf',kind:'document',size:stat.size,createdById:owner.id}});
    const job=await tx.bookImport.create({data:{id:crypto.randomUUID(),bookId:book.id,sourceAssetId:sourceId,filename:settings.filename,format:'pdf',mode:'ocr',createdById:owner.id,sources:JSON.stringify([{id:sourceId,filename,name:settings.filename,format:'pdf',mimeType:'application/pdf',language:'fa-IR'}])}});
    return {bookId:book.id,importId:job.id,status:job.status};
  });console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Queue failed');process.exitCode=1;}).finally(()=>prisma.$disconnect());
