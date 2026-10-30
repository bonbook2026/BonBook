import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import express from 'express';
import {Server} from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {execFileSync} from 'child_process';
import {config} from '../src/config';

describe('Live saved-book setup checklist',()=>{
 const directory=path.resolve(__dirname,'../../build'),database=path.join(directory,'setup-progress-'+crypto.randomUUID()+'.db');
 const saved={nodeEnv:config.nodeEnv,jwtSecret:config.jwtSecret,frontendUrl:config.frontendUrl};
 let prisma:any,server:Server,base:string,token:string,readerToken:string,owner:any,coverId:string,imageId:string,audioId:string;
 const call=(route:string,body?:unknown,method=body===undefined?'GET':'POST',credential=token)=>fetch(base+'/api/admin'+route,{method,headers:{Authorization:'Bearer '+credential,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const progress=async(id:number)=>{const result=await call(`/books/${id}/setup-progress`);expect(result.status).toBe(200);return (await result.json()).progress;};
 const step=(result:any,id:string)=>result.steps.find((row:any)=>row.id===id);
 beforeAll(async()=>{
  fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(database,'');vi.stubEnv('DATABASE_URL','file:'+database.replace(/\\/g,'/'));
  execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.resolve(__dirname,'../prisma/schema.prisma')],{env:process.env,stdio:'pipe'});
  config.nodeEnv='test';config.jwtSecret=crypto.randomBytes(32).toString('hex');
  prisma=(await import('../src/lib/prisma')).default;const {generateToken}=await import('../src/middleware/auth');
  owner=await prisma.user.create({data:{telegramId:'fixture:setup-owner',role:'OWNER'}});const reader=await prisma.user.create({data:{telegramId:'fixture:setup-reader'}});
  token=generateToken(owner.id,owner.telegramId);readerToken=generateToken(reader.id,reader.telegramId);
  [coverId,imageId,audioId]=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
  for(const [id,kind,mimeType] of [[coverId,'cover','image/png'],[imageId,'page-image','image/png'],[audioId,'audio','audio/wav']])await prisma.mediaAsset.create({data:{id,kind,mimeType,filename:id,size:100,createdById:owner.id}});
  const routes=(await import('../src/routes')).default,{errorHandler}=await import('../src/middleware/errorHandler');const app=express();app.use(express.json());app.use('/api',routes);app.use(errorHandler);
  server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base='http://127.0.0.1:'+(server.address() as any).port;config.frontendUrl=base;
 },30000);
 afterAll(async()=>{
  if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));if(prisma)await prisma.$disconnect();Object.assign(config,saved);vi.unstubAllEnvs();vi.restoreAllMocks();
  if(path.dirname(database)!==directory||!path.basename(database).startsWith('setup-progress-'))throw Error('Unsafe fixture cleanup');
  for(const suffix of ['','-wal','-shm','-journal'])if(fs.existsSync(database+suffix))fs.unlinkSync(database+suffix);
 });
 it('requires an administrator and never exposes saved text or media links',async()=>{
  const book=await prisma.libraryBook.create({data:{title:'Private fixture',author:'Author',pages:{create:{number:1,content:'PRIVATE-PAGE-CONTENT-DO-NOT-RETURN'}}}});
  expect((await call(`/books/${book.id}/setup-progress`,undefined,'GET',readerToken)).status).toBe(403);
  const response=await call(`/books/${book.id}/setup-progress`);expect(response.headers.get('Cache-Control')).toContain('no-store');const body=await response.text();expect(body).not.toContain('PRIVATE-PAGE-CONTENT');expect(body).not.toContain('audioAssetId');
  await prisma.libraryBook.update({where:{id:book.id},data:{status:'TRASH'}});expect((await call(`/books/${book.id}/setup-progress`)).status).toBe(404);expect((await call('/books/999999/setup-progress')).status).toBe(404);
 });
 it('updates completion only after real saves, requires applying speech suggestions, and reopens removed work',async()=>{
  const created=await call('/books',{title:'Checklist fixture'});const {book}=await created.json();let state=await progress(book.id);expect(step(state,'metadata').status).toBe('todo');expect(step(state,'cover').status).not.toBe('done');
  const metadata={title:book.title,author:'Author',description:'',category:'عمومی',coverTone:'sand',language:'fa-IR',status:'DRAFT',coverAssetId:coverId};
  expect((await call(`/books/${book.id}`,metadata,'PUT')).status).toBe(200);state=await progress(book.id);expect(step(state,'metadata').status).toBe('done');expect(step(state,'cover').status).toBe('done');
  const draft={number:1,heading:'',content:'',keywords:'',audioAssetId:null,audioCues:[],imageAssetId:imageId,visualMode:'AUTO'};
  expect((await call(`/books/${book.id}/pages/1`,draft,'PUT')).status).toBe(200);state=await progress(book.id);expect(step(state,'pages').status).toBe('done');expect(step(state,'text').pageNumbers).toEqual([1]);
  const narrated={...draft,content:'متن واقعی ذخیره‌شده',audioAssetId:audioId};expect((await call(`/books/${book.id}/pages/1`,narrated,'PUT')).status).toBe(200);
  state=await progress(book.id);expect(step(state,'text').status).toBe('done');expect(step(state,'audio').status).toBe('done');expect(step(state,'alignment').status).toBe('todo');
  const page=await prisma.libraryPage.findUnique({where:{bookId_number:{bookId:book.id,number:1}}});const alignment=await prisma.audioAlignment.create({data:{id:crypto.randomUUID(),pageId:page.id,audioAssetId:audioId,contentHash:crypto.createHash('sha256').update(page.content).digest('hex'),createdById:owner.id,status:'READY',coverage:.95,lineCoverage:1,cues:'[{"time":0,"offset":0}]'}});
  expect(step(await progress(book.id),'alignment').status).toBe('review');expect((await call(`/alignments/${alignment.id}/apply`,{})).status).toBe(200);expect(step(await progress(book.id),'alignment').status).toBe('done');
  expect((await call(`/books/${book.id}/state`,{action:'publish'})).status).toBe(200);expect(await progress(book.id)).toMatchObject({completed:6,total:6,nextStep:null});
  expect((await call(`/books/${book.id}/pages/1`,{...narrated,audioAssetId:null},'PUT')).status).toBe(200);state=await progress(book.id);expect(state.nextStep).toBe('audio');expect(step(state,'audio').status).toBe('todo');
  expect((await call(`/books/${book.id}/state`,{action:'hide'})).status).toBe(200);expect(step(await progress(book.id),'publish').status).toBe('todo');
 });
 it('does not count planned batch files as uploaded audio and respects explicitly image-only pages',async()=>{
  const book=await prisma.libraryBook.create({data:{title:'Picture fixture',author:'Author',pages:{create:{number:1,content:'',imageAssetId:imageId,visualMode:'IMAGE'}}}});
  expect(step(await progress(book.id),'text').status).toBe('optional');expect(step(await progress(book.id),'audio').status).toBe('optional');
  expect((await call(`/books/${book.id}/audio-batches`,{files:[{filename:'1.mp3',pageNumber:1,size:100}],replaceExisting:false,autoAlign:false})).status).toBe(201);
  const state=await progress(book.id);expect(step(state,'audio')).toMatchObject({status:'working',completed:0});expect(step(state,'alignment').status).toBe('optional');
 });
});
