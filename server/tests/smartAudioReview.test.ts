import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import express from 'express';
import {Server} from 'http';
import fs from 'fs';import path from 'path';import crypto from 'crypto';import {execFileSync} from 'child_process';
import {config} from '../src/config';
describe('Private reversible bulk audio review',()=>{
 const directory=path.resolve(__dirname,'../../build'),database=path.join(directory,'smart-review-'+crypto.randomUUID()+'.db');
 const saved={nodeEnv:config.nodeEnv,jwtSecret:config.jwtSecret,frontendUrl:config.frontendUrl};
 let prisma:any,server:Server,base:string,owner:any,token:string,readerToken:string,review:any,speech:any;
 const text='کتاب زندگی زیباست.\nجهان روشن است.\nصدای تازه می‌آید.';
 const call=(route:string,method='GET',credential=token)=>fetch(base+'/api/admin'+route,{method,headers:{Authorization:'Bearer '+credential}});
 beforeAll(async()=>{
  fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(database,'');vi.stubEnv('DATABASE_URL','file:'+database.replace(/\\/g,'/'));
  execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.resolve(__dirname,'../prisma/schema.prisma')],{env:process.env,stdio:'pipe'});
  config.nodeEnv='test';config.jwtSecret=crypto.randomBytes(32).toString('hex');prisma=(await import('../src/lib/prisma')).default;
  const {generateToken}=await import('../src/middleware/auth');owner=await prisma.user.create({data:{telegramId:'fixture:smart-owner',role:'OWNER'}});
  const reader=await prisma.user.create({data:{telegramId:'fixture:smart-reader'}});token=generateToken(owner.id,owner.telegramId);readerToken=generateToken(reader.id,reader.telegramId);
  review=await import('../src/services/smartAudioReview');speech=await import('../src/services/speechService');
  const routes=(await import('../src/routes')).default,{errorHandler}=await import('../src/middleware/errorHandler');const app=express();app.use(express.json());app.use('/api',routes);app.use(errorHandler);
  server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base='http://127.0.0.1:'+(server.address() as any).port;config.frontendUrl=base;
 },30000);
 afterAll(async()=>{
  vi.restoreAllMocks();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));if(prisma)await prisma.$disconnect();Object.assign(config,saved);vi.unstubAllEnvs();
  if(path.dirname(database)!==directory||!path.basename(database).startsWith('smart-review-'))throw Error('Unsafe fixture cleanup');
  for(const suffix of ['','-wal','-shm','-journal'])if(fs.existsSync(database+suffix))fs.unlinkSync(database+suffix);
 });
 async function fixture(modes=['NONE']){
  const book=await prisma.libraryBook.create({data:{title:'Smart review fixture',language:'fa-IR'}});const pages=[];
  for(const [index,mode] of modes.entries()){
   const audioId=crypto.randomUUID();await prisma.mediaAsset.create({data:{id:audioId,filename:audioId,mimeType:'audio/wav',kind:'audio',size:100,createdById:owner.id}});
   const audioCues=mode==='MANUAL'?'[ {"offset":0,"time":1.123} ]':mode==='PARTIAL'?'[{"offset":0,"time":1.123}]':'[]';
   const page=await prisma.libraryPage.create({data:{bookId:book.id,number:index+1,content:text,audioAssetId:audioId,audioCues,audioCueMode:mode}});
   const source=await prisma.audioAlignment.create({data:{id:crypto.randomUUID(),pageId:page.id,audioAssetId:audioId,contentHash:speech.contentHash(text),createdById:owner.id,status:'REVIEW',duration:12,words:JSON.stringify([{text:'کتاب',start:1,end:2,probability:1}])}});pages.push({...page,source});
  }return {book,pages};
 }
 function result(){const lines=speech.readingLines(text);return {cues:lines.map((line:any,i:number)=>({offset:line.start,time:i*3+1})),evidence:lines.map((line:any)=>({offset:line.start,total:3,matched:3,leadingMissed:0,probability:.95})),words:[{text:'کتاب',start:1,end:2,probability:1}],coverage:.95,spokenCoverage:.95,lineCoverage:1,safe:true,duration:12};}
 it('requires an administrator, fixes blanks, preserves exact old times, is idempotent and restores only untouched results',async()=>{
  const {book,pages}=await fixture(['NONE','MANUAL','PARTIAL']);const url=`/books/${book.id}/audio-review`;
  expect((await call(url,'POST',readerToken)).status).toBe(403);
  const response=await call(url,'POST');expect(response.status).toBe(202);const started=await response.json();
  expect((await (await call(url,'POST')).json()).run.id).toBe(started.run.id);
  const spy=vi.spyOn(speech,'recognizeSpeech').mockImplementation(async()=>result());
  for(let i=0;i<3;i++)expect(await review.processNextSmartReview()).toBe(true);
  const complete=await (await call(url)).json();expect(complete.run.status).toBe('COMPLETE');expect(complete.run.items.map((row:any)=>row.status)).toEqual(['FIXED','PRESERVED','FIXED']);
  const first=await prisma.libraryPage.findUnique({where:{id:pages[0].id}}),manual=await prisma.libraryPage.findUnique({where:{id:pages[1].id}}),partial=await prisma.libraryPage.findUnique({where:{id:pages[2].id}});
  expect(JSON.parse(first.audioCues)).toHaveLength(3);expect(manual.audioCues).toBe(pages[1].audioCues);expect(manual.updatedAt).toEqual(pages[1].updatedAt);expect(JSON.parse(partial.audioCues)[0].time).toBe(1.123);
  expect(first.content).toBe(text);expect(first.audioAssetId).toBe(pages[0].audioAssetId);
  expect((await (await call(url,'POST')).json()).run.id).toBe(started.run.id);
  const data=await (await call(url)).text();expect(data).not.toContain(text);expect(data).not.toContain('beforeCues');expect(data).not.toContain('audioAssetId');
  await prisma.libraryPage.update({where:{id:pages[2].id},data:{audioCues:'[{"time":2.222,"offset":0}]',audioCueMode:'MANUAL'}});
  const undo=await (await call(url+`/${started.run.id}/undo`,'POST')).json();expect(undo).toEqual({restored:1,skipped:1});
  expect((await prisma.libraryPage.findUnique({where:{id:pages[0].id}})).audioCues).toBe('[]');expect((await prisma.libraryPage.findUnique({where:{id:pages[2].id}})).audioCues).toContain('2.222');
  spy.mockRestore();
 });
 it('detects edits during processing and never overwrites the new manual timing',async()=>{
  const {book,pages}=await fixture();await review.startSmartReview(book.id,owner.id);
  const spy=vi.spyOn(speech,'recognizeSpeech').mockImplementation(async()=>{await prisma.libraryPage.update({where:{id:pages[0].id},data:{audioCues:'[{"offset":0,"time":9}]',audioCueMode:'MANUAL'}});return result();});
  await review.processNextSmartReview();expect((await review.getSmartReview(book.id)).run.items[0].status).toBe('CHANGED');expect((await prisma.libraryPage.findUnique({where:{id:pages[0].id}})).audioCues).toContain('9');spy.mockRestore();
 });
 it('automatically queues later completed recognition and cancellation disables future review',async()=>{
  const {book,pages}=await fixture();await review.startSmartReview(book.id,owner.id);await review.stopSmartReview(book.id);
  expect((await review.getSmartReview(book.id)).enabled).toBe(false);expect(await review.processNextSmartReview()).toBe(false);
  await review.startSmartReview(book.id,owner.id);const spy=vi.spyOn(speech,'recognizeSpeech').mockImplementation(async()=>result());await review.processNextSmartReview();
  const source=await prisma.audioAlignment.create({data:{id:crypto.randomUUID(),pageId:pages[0].id,audioAssetId:pages[0].audioAssetId,contentHash:speech.contentHash(text),createdById:owner.id,status:'REVIEW',duration:12,words:JSON.stringify(result().words)}});
  await review.queueFutureSmartReview(source.id);await review.queueFutureSmartReview(source.id);
  const pending=await review.getSmartReview(book.id);expect(pending.run.items.filter((item:any)=>item.status==='WAITING')).toHaveLength(1);spy.mockRestore();
  await review.stopSmartReview(book.id);
 });
});
