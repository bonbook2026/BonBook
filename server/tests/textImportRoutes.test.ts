import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import express from 'express';
import {Server} from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {execFileSync} from 'child_process';
import {config} from '../src/config';

describe('Prepared text preview, guarded replacement and undo',()=>{
 const fixture=path.resolve(__dirname,'../../build/text-import-'+crypto.randomUUID()),database=fixture+'.db';
 const saved={nodeEnv:config.nodeEnv,mediaDirectory:config.mediaDirectory,jwtSecret:config.jwtSecret,frontendUrl:config.frontendUrl};
 let prisma:any,server:Server,base:string,token:string,readerToken:string,book:any,audioId:string;
 const call=(route:string,body?:unknown,credential=token)=>fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+credential,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const preview=async(text:string,filename='full.txt',bookId=book.id)=>{const form=new FormData();form.append('pageOffset','0');form.append('files',new Blob([text],{type:'text/plain'}),filename);return fetch(`${base}/api/admin/media/text-import/${bookId}`,{method:'POST',headers:{Authorization:'Bearer '+token},body:form});};
 const unchanged=(p:any)=>[p.id,p.bookId,p.number,p.heading,p.keywords,p.audioAssetId,p.imageAssetId,p.sourceAssetId,p.sourcePageNumber,p.visualMode];
 beforeAll(async()=>{
  fs.mkdirSync(fixture,{recursive:true});fs.writeFileSync(database,'');vi.stubEnv('DATABASE_URL','file:'+database.replace(/\\/g,'/'));
  execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.resolve(__dirname,'../prisma/schema.prisma')],{env:process.env,stdio:'pipe'});
  config.nodeEnv='test';config.mediaDirectory=path.join(fixture,'media');config.jwtSecret=crypto.randomBytes(32).toString('hex');
  prisma=(await import('../src/lib/prisma')).default;const {generateToken}=await import('../src/middleware/auth');
  const owner=await prisma.user.create({data:{telegramId:'fixture:text-owner',role:'OWNER'}}),reader=await prisma.user.create({data:{telegramId:'fixture:text-reader'}});
  token=generateToken(owner.id,owner.telegramId);readerToken=generateToken(reader.id,reader.telegramId);audioId=crypto.randomUUID();const pdfId=crypto.randomUUID();
  for(const [id,kind,mimeType] of [[audioId,'audio','audio/wav'],[pdfId,'document','application/pdf']])await prisma.mediaAsset.create({data:{id,kind,mimeType,filename:id,size:100,createdById:owner.id}});
  book=await prisma.libraryBook.create({data:{title:'کتاب نمونهٔ متن',status:'PUBLISHED',pages:{create:[{number:1,heading:'عنوان محفوظ',content:'جهان یکی است.\nانسان زندگی را تجربه میکند.',keywords:'جهان',audioAssetId:audioId,audioCues:'[{"time":0.5,"offset":0},{"time":12,"offset":14}]',audioCueMode:'MANUAL',sourceAssetId:pdfId,sourcePageNumber:1,visualMode:'BOTH'},{number:2,heading:'تصویر',content:'نسخهٔ موجود',sourceAssetId:pdfId,sourcePageNumber:2}]}}});
  await prisma.bookContents.create({data:{bookId:book.id,title:'عنوان فهرست',pageNumber:1}});await prisma.readingProgress.create({data:{userId:reader.id,bookId:book.id,pageNumber:2}});
  const routes=(await import('../src/routes')).default,{errorHandler}=await import('../src/middleware/errorHandler');const app=express();app.use(express.json());app.use('/api',routes);app.use(errorHandler);
  server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base='http://127.0.0.1:'+(server.address() as any).port;config.frontendUrl=base;
 },30000);
 afterAll(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));if(prisma)await prisma.$disconnect();Object.assign(config,saved);vi.unstubAllEnvs();vi.restoreAllMocks();fs.rmSync(fixture,{recursive:true,force:true});for(const suffix of ['','-wal','-shm','-journal'])if(fs.existsSync(database+suffix))fs.unlinkSync(database+suffix);});
 it('requires administration and never replaces during preview',async()=>{
  expect((await call(`/api/admin/books/${book.id}/text-imports`,undefined,readerToken)).status).toBe(403);
  const before=await prisma.libraryPage.findMany({where:{bookId:book.id},orderBy:{number:'asc'}});
  const response=await preview('=== Page 1 ===\nجهان، یکی است.\nانسان زندگی را تجربه می‌کند.\n=== Page 2 ===\n\n=== Page 3 ===\nناشناخته');expect(response.status).toBe(201);const {import:job}=await response.json();
  expect(job.items.map((p:any)=>p.status)).toEqual(['READY','EMPTY','MISSING']);expect(job.items[0].beforeContent).toBeUndefined();expect(job.items[0].canApply).toBe(true);
  expect(await prisma.libraryPage.findMany({where:{bookId:book.id},orderBy:{number:'asc'}})).toEqual(before);
  const detail=await(await call(`/api/admin/books/${book.id}/text-imports/${job.id}/pages/1`)).json();expect(detail.item.content).toContain('می‌کند');expect(detail.item.beforeContent).toContain('میکند');
 });
 it('accepts a complete text source above the ordinary JSON body limit through the media upload path',async()=>{
  const text=Array.from({length:28},(_,i)=>`=== Page ${i+1} ===\n`+'گ'.repeat(20000)).join('\n');expect(Buffer.byteLength(text)).toBeGreaterThan(1024*1024);
  const response=await preview(text);expect(response.status).toBe(201);expect((await response.json()).import.items).toHaveLength(28);
 });
 it('keeps media, identifiers, headings, contents, progress and every cue timestamp through apply and undo',async()=>{
  const before=await prisma.libraryPage.findMany({where:{bookId:book.id},orderBy:{number:'asc'}}),progress=await prisma.readingProgress.findMany(),contents=await prisma.bookContents.findMany();
  const {import:job}=await(await preview('=== Page 1 ===\nجهان، یکی است.\nانسان زندگی را تجربه می‌کند.\n=== Page 2 ===\n')).json();
  expect((await call(`/api/admin/books/${book.id}/text-imports/${job.id}/apply`,{pages:[1,2]})).status).toBe(400);
  const applied=await call(`/api/admin/books/${book.id}/text-imports/${job.id}/apply`,{pages:[1]});expect(applied.status).toBe(200);expect((await applied.json()).updated).toBe(1);
  const after=await prisma.libraryPage.findMany({where:{bookId:book.id},orderBy:{number:'asc'}});expect(after.map(unchanged)).toEqual(before.map(unchanged));expect(after[1]).toEqual(before[1]);
  expect(JSON.parse(after[0].audioCues).map((c:any)=>c.time)).toEqual(JSON.parse(before[0].audioCues).map((c:any)=>c.time));expect(after[0].audioCueMode).toBe('MANUAL');expect(after[0].searchText).toContain('تجربه');
  expect(await prisma.readingProgress.findMany()).toEqual(progress);expect(await prisma.bookContents.findMany()).toEqual(contents);
  expect((await call(`/api/admin/books/${book.id}/text-imports/${job.id}/apply`,{pages:[1]})).status).toBe(409);
  expect((await call(`/api/admin/books/${book.id}/text-imports/${job.id}/undo`,{})).status).toBe(200);
  const restored=await prisma.libraryPage.findUnique({where:{id:before[0].id}});expect(restored.content).toBe(before[0].content);expect(restored.audioCues).toBe(before[0].audioCues);expect(restored.audioCueMode).toBe(before[0].audioCueMode);
 });
 it('aborts the complete transaction on a stale preview, including concurrent audio/timing edits',async()=>{
  const {import:job}=await(await preview('=== Page 1 ===\nجهان، یکی است.\nانسان زندگی را تجربه می‌کند.\n=== Page 2 ===\nنسخهٔ موجود اصلاح شد')).json();
  const page=await prisma.libraryPage.findFirst({where:{bookId:book.id,number:2}});await prisma.libraryPage.update({where:{id:page.id},data:{heading:'ویرایش تازه'}});
  const before=await prisma.libraryPage.findFirst({where:{bookId:book.id,number:1}});
  expect((await call(`/api/admin/books/${book.id}/text-imports/${job.id}/apply`,{pages:[1,2]})).status).toBe(409);
  expect((await prisma.libraryPage.findUnique({where:{id:before.id}})).content).toBe(before.content);
 });
 it('refuses an undo that would overwrite a later page edit, or a job from another book',async()=>{
  const {import:job}=await(await preview('=== Page 1 ===\nجهان، یکی است.\nانسان زندگی را تجربه می‌کند.')).json();
  expect((await call(`/api/admin/books/${book.id}/text-imports/${job.id}/apply`,{pages:[1]})).status).toBe(200);
  const page=await prisma.libraryPage.findFirst({where:{bookId:book.id,number:1}});await prisma.libraryPage.update({where:{id:page.id},data:{keywords:'ویرایش جدید'}});
  expect((await call(`/api/admin/books/${book.id}/text-imports/${job.id}/undo`,{})).status).toBe(409);
  const other=await prisma.libraryBook.create({data:{title:'کتاب دیگر'}});expect((await call(`/api/admin/books/${other.id}/text-imports/${job.id}`)).status).toBe(404);
 });
 it('rejects duplicate page sources before creating a revision and keeps ready ASR results stale',async()=>{
  expect((await preview('=== Page 1 ===\nاول\n=== Page 1 ===\nدوم')).status).toBe(400);
  const {contentHash,applyAlignment}=await import('../src/services/speechService'),page=await prisma.libraryPage.findFirst({where:{bookId:book.id,number:1}});
  const alignment=await prisma.audioAlignment.create({data:{id:crypto.randomUUID(),pageId:page.id,audioAssetId:audioId,contentHash:contentHash(page.content),previousCues:page.audioCues,status:'READY',cues:'[{"time":1,"offset":0}]',createdById:1}});
  const {import:job}=await(await preview('=== Page 1 ===\nجهان، یکی است.\nانسان زندگی را تجربه می‌کند.\nمتن تازه اضافه شد.')).json();expect((await call(`/api/admin/books/${book.id}/text-imports/${job.id}/apply`,{pages:[1]})).status).toBe(200);
  await expect(applyAlignment(alignment.id)).rejects.toThrow('متن یا ویس');
 });
 it('commits multiple SQL chunks while another WAL connection continues reading, and can undo the whole batch',async()=>{
  await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  const target=await prisma.libraryBook.create({data:{title:'هم‌زمانی کتاب بزرگ',pages:{create:Array.from({length:180},(_,i)=>({number:i+1,content:'جهان یکی است.',heading:'عنوان محفوظ'}))}}});
  const source=Array.from({length:180},(_,i)=>`=== Page ${i+1} ===\nجهان، یکی است.`).join('\n');
  const {import:job}=await(await preview(source,'full.txt',target.id)).json();expect(job.items.every((p:any)=>p.status==='READY')).toBe(true);
  const {PrismaClient}=await import('@prisma/client'),readerConnection=new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL+'?connection_limit=1'}}});
  // Prisma interactive transactions use BEGIN IMMEDIATE even for reads. A
  // genuinely deferred, one-connection reader models a book-page snapshot.
  await readerConnection.$executeRawUnsafe('BEGIN DEFERRED');
  await readerConnection.libraryPage.findFirst({where:{bookId:target.id}});
  const changeRequest=call(`/api/admin/books/${target.id}/text-imports/${job.id}/apply`,{pages:job.items.map((p:any)=>p.sourceNumber)});
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const response=await Promise.race([changeRequest,new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),5000);})]);
   expect(response,'A reader must not block a whole-book text commit').not.toBeNull();expect(response!.status).toBe(200);expect((await response!.json()).updated).toBe(180);
  }finally{if(timer)clearTimeout(timer);await readerConnection.$executeRawUnsafe('ROLLBACK');await readerConnection.$disconnect();await changeRequest;}
  expect((await call(`/api/admin/books/${target.id}/text-imports/${job.id}/undo`,{})).status).toBe(200);
  expect(await prisma.libraryPage.count({where:{bookId:target.id,content:'جهان یکی است.'}})).toBe(180);
  const writers=await Promise.allSettled(Array.from({length:8},()=>prisma.$transaction(async(tx:any)=>{await tx.libraryBook.update({where:{id:target.id},data:{updatedAt:new Date()}});return tx.libraryPage.count({where:{bookId:target.id}});})));expect(writers.every(result=>result.status==='fulfilled')).toBe(true);
 });
});
