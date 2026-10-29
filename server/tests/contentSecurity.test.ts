import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import express from 'express';
import {Server} from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import {execFileSync} from 'child_process';
import {config} from '../src/config';

describe('Content access, account watermarks and revocable media grants',()=>{
 const fixture=path.resolve(__dirname,'../../build/content-security-'+crypto.randomUUID()),database=fixture+'.db',media=fixture+'-media';
 const saved={nodeEnv:config.nodeEnv,mediaDirectory:config.mediaDirectory,jwtSecret:config.jwtSecret,frontendUrl:config.frontendUrl};
 let prisma:any,server:Server,base:string,owner:any,reader:any,other:any,adminToken:string,readerToken:string,otherToken:string,book:any,audioId:string,imageId:string,pdfId:string,sign:any,mark:any;
 const call=(route:string,token?:string,extra:RequestInit={})=>fetch(base+route,{...extra,headers:{...(token?{Authorization:'Bearer '+token}:{}),...extra.headers}});
 const identity=(user:any,token:string)=>({userId:user.id,role:user.role,sessionId:crypto.createHash('sha256').update(token).digest('hex'),token,expires:(jwt.decode(token) as any).exp,watermark:mark(user.id)});
 beforeAll(async()=>{
  fs.mkdirSync(media,{recursive:true});fs.writeFileSync(database,'');vi.stubEnv('DATABASE_URL','file:'+database.replace(/\\/g,'/'));
  execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.resolve(__dirname,'../prisma/schema.prisma')],{env:process.env,stdio:'pipe'});
  config.nodeEnv='test';config.mediaDirectory=media;config.jwtSecret=crypto.randomBytes(32).toString('hex');
  prisma=(await import('../src/lib/prisma')).default;
  const {generateToken}=await import('../src/middleware/auth'),protection=await import('../src/services/contentProtection');sign=protection.signedMediaUrl;mark=protection.accountWatermark;
  owner=await prisma.user.create({data:{telegramId:'fixture:security-owner',role:'OWNER'}});reader=await prisma.user.create({data:{telegramId:'fixture:security-reader'}});other=await prisma.user.create({data:{telegramId:'fixture:security-other'}});
  adminToken=generateToken(owner.id,owner.telegramId);readerToken=generateToken(reader.id,reader.telegramId);otherToken=generateToken(other.id,other.telegramId);
  audioId=crypto.randomUUID();imageId=crypto.randomUUID();pdfId=crypto.randomUUID();
  const wav=Buffer.alloc(1644);wav.write('RIFF');wav.writeUInt32LE(1636,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(1600,40);
  fs.writeFileSync(path.join(media,audioId+'.wav'),wav);fs.writeFileSync(path.join(media,pdfId+'.pdf'),'%PDF-1.4\nprivate fixture');await sharp({create:{width:800,height:1000,channels:3,background:'#fffdf7'}}).png().toFile(path.join(media,imageId+'.png'));
  for(const [id,kind,mimeType,extension] of [[audioId,'audio','audio/wav','wav'],[imageId,'page-image','image/png','png'],[pdfId,'document','application/pdf','pdf']])await prisma.mediaAsset.create({data:{id,kind,mimeType,filename:id+'.'+extension,size:fs.statSync(path.join(media,id+'.'+extension)).size,createdById:owner.id}});
  book=await prisma.libraryBook.create({data:{title:'Protected fixture',status:'PUBLISHED',pages:{create:[{number:1,heading:'فصل حفاظت',content:'متن اختصاصی کتاب. '.repeat(100),searchText:'متن اختصاصی کتاب',imageAssetId:imageId,audioAssetId:audioId},{number:2,heading:'تصویر پی‌دی‌اف',content:'متن صفحهٔ دوم',sourceAssetId:pdfId,sourcePageNumber:1}]}}});
  const routes=(await import('../src/routes')).default,{errorHandler}=await import('../src/middleware/errorHandler');const app=express();app.use(express.json());app.use('/api',routes);app.use(errorHandler);
  server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base='http://127.0.0.1:'+(server.address() as any).port;config.frontendUrl=base;
 },30000);
 afterAll(async()=>{vi.restoreAllMocks();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));if(prisma)await prisma.$disconnect();Object.assign(config,saved);vi.unstubAllEnvs();for(const name of fs.readdirSync(media))fs.unlinkSync(path.join(media,name));fs.rmdirSync(media);for(const suffix of ['','-wal','-shm','-journal'])if(fs.existsSync(database+suffix))fs.unlinkSync(database+suffix);});
 it('keeps catalog metadata public but requires a live account for page bodies, search and book media',async()=>{
  expect((await call('/api/library')).status).toBe(200);const metadata=await(await call('/api/library/'+book.id)).json();expect(metadata.book.pageCount).toBe(2);expect(metadata.book.pages).toBeUndefined();expect(metadata.book.contents).toBeUndefined();
  for(const route of [`/api/library/${book.id}/pages/1`,'/api/library/search?q='+encodeURIComponent('اختصاصی'),'/api/media/'+audioId,'/api/media/'+imageId,`/api/media/${pdfId}/pages/1/image`])expect((await call(route)).status).toBe(401);
  expect((await call('/api/media/'+pdfId)).status).toBe(403);expect((await call('/api/media/'+pdfId,readerToken)).status).toBe(403);expect((await call('/api/media/'+pdfId,adminToken)).status).toBe(200);
 });
 it('rejects unsigned, shared, altered, expired, overlong and array-valued grants',async()=>{
  const {page}=await(await call(`/api/library/${book.id}/pages/1`,readerToken)).json();expect(page.audioUrl).toContain('grant=');expect(page.sourceUrl).toBeNull();expect(page.protection.watermark).toBe(mark(reader.id));
  expect((await call('/api/media/'+audioId,readerToken)).status).toBe(403);expect((await call(page.audioUrl)).status).toBe(401);expect((await call(page.audioUrl,otherToken)).status).toBe(403);
  expect((await call(page.audioUrl.replace(audioId,imageId),readerToken)).status).toBe(403);
  const url=new URL(page.audioUrl,base);url.searchParams.set('grant','a'.repeat(64));expect((await call(url.pathname+url.search,readerToken)).status).toBe(403);
  for(const expires of [Math.floor(Date.now()/1000)-60,Math.floor(Date.now()/1000)+5*3600]){const route='/api/media/'+audioId,session=identity(reader,readerToken).sessionId,grant=crypto.createHmac('sha256',config.jwtSecret).update(`media\0${route}\n${expires}\n${session}`).digest('hex');expect((await call(`${route}?expires=${expires}&grant=${grant}`,readerToken)).status).toBe(403);}
  expect((await call(page.audioUrl.replace('grant=','grant[]='),readerToken)).status).toBe(403);
 });
 it('never publishes a store book original URL to an ordinary authenticated account',async()=>{
  await prisma.book.create({data:{title:'Store source fixture',fileUrl:'https://private.example.invalid/original.pdf'}});
  const response=await call('/api/books',readerToken);expect(response.status).toBe(200);const data=await response.json();expect(data.books[0].fileUrl).toBeUndefined();expect(JSON.stringify(data)).not.toContain('private.example.invalid');
 });
 it('serves bounded audio ranges with no-store and rejects cross-site embedding',async()=>{
  const {page}=await(await call(`/api/library/${book.id}/pages/1`,readerToken)).json();const response=await call(page.audioUrl,readerToken,{headers:{Range:'bytes=0-15'}});
  expect(response.status).toBe(206);expect(Buffer.from(await response.arrayBuffer()).length).toBe(16);expect(response.headers.get('content-range')).toBe('bytes 0-15/1644');expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');expect(response.headers.get('vary')).toContain('Cookie');
  expect((await call(page.audioUrl,readerToken,{headers:{'Sec-Fetch-Site':'cross-site'}})).status).toBe(403);
 });
 it('burns each account identifier into actual image bytes and leaves the source unchanged',async()=>{
  const original=fs.readFileSync(path.join(media,imageId+'.png'));
  const a=await(await call(`/api/library/${book.id}/pages/1`,readerToken)).json(),b=await(await call(`/api/library/${book.id}/pages/1`,otherToken)).json();
  const first=Buffer.from(await(await call(a.page.imageUrl,readerToken)).arrayBuffer()),second=Buffer.from(await(await call(b.page.imageUrl,otherToken)).arrayBuffer());
  expect(first.equals(original)).toBe(false);expect(first.equals(second)).toBe(false);expect(fs.readFileSync(path.join(media,imageId+'.png')).equals(original)).toBe(true);expect(await sharp(first).metadata()).toMatchObject({format:'png',width:800,height:1000});
 });
 it('does not turn one published PDF page into access to unpublished source pages',async()=>{
  const renderer=await import('../src/services/pageImageService'),render=vi.spyOn(renderer,'pdfPageImage').mockResolvedValue(path.join(media,imageId+'.png'));
  try{const {page}=await(await call(`/api/library/${book.id}/pages/2`,readerToken)).json();expect((await call(page.sourceImageUrl,readerToken)).status).toBe(200);const unauthorized=sign(`/api/media/${pdfId}/pages/2/image`,identity(reader,readerToken));expect((await call(unauthorized,readerToken)).status).toBe(404);expect(render).toHaveBeenCalledTimes(1);}finally{render.mockRestore();}
 });
 it('returns search excerpts without bulk page bodies or playable media links',async()=>{
  const result=await(await call('/api/library/search?q='+encodeURIComponent('اختصاصی'),readerToken)).json();expect(result.results).toHaveLength(1);expect(result.results[0].content.length).toBeLessThan(600);expect(result.results[0].audioUrl).toBeNull();expect(result.results[0].imageUrl).toBeNull();expect(result.results[0].audioCues).toEqual([]);
 });
 it('keeps the same session on reload and revokes copied URLs and credentials after logout',async()=>{
  const {generateToken}=await import('../src/middleware/auth'),token=generateToken(reader.id,reader.telegramId),{page}=await(await call(`/api/library/${book.id}/pages/1`,token)).json();
  const session=await call('/api/auth/session',token);expect(session.status).toBe(200);expect((await session.json()).token).toBe('');expect(session.headers.get('set-cookie')).toBeNull();
  expect((await call('/api/auth/logout',token,{method:'POST'})).status).toBe(200);expect((await call(page.audioUrl,token)).status).toBe(401);expect((await call('/api/auth/session',token)).status).toBe(401);
  const fresh=generateToken(reader.id,reader.telegramId);expect(fresh).not.toBe(token);expect((await call(`/api/library/${book.id}/pages/1`,fresh)).status).toBe(200);
 });
 it('lets the owner trace a watermark and revoke a session, while denying reader administration and forged roles',async()=>{
  const denied=jwt.sign({userId:reader.id,telegramId:reader.telegramId,role:'OWNER'},config.jwtSecret,{expiresIn:'1h'});expect((await call('/api/admin/content-security',denied)).status).toBe(403);
  const helper=await prisma.user.create({data:{telegramId:'fixture:security-helper',role:'ADMIN'}}),{generateToken}=await import('../src/middleware/auth');expect((await call('/api/admin/content-security',generateToken(helper.id,helper.telegramId))).status).toBe(403);
  const data=await(await call('/api/admin/content-security?code='+mark(other.id),adminToken)).json();expect(data.account.id).toBe(other.id);expect(data.sessions.length).toBeGreaterThan(0);expect(JSON.stringify(data)).not.toContain(otherToken);
  const session=data.sessions.find((row:any)=>row.id===identity(other,otherToken).sessionId);expect(session).toBeTruthy();expect((await call('/api/admin/content-security/sessions/'+session.id+'/revoke',adminToken,{method:'POST'})).status).toBe(200);expect((await call(`/api/library/${book.id}/pages/1`,otherToken)).status).toBe(401);
  const audit=await(await call('/api/admin/content-security',adminToken)).json();expect(audit.events.some((row:any)=>row.kind==='INVALID_MEDIA_GRANT')).toBe(true);expect(audit.events.some((row:any)=>row.kind==='SESSION_REVOKED')).toBe(true);
 });
 it('rejects forged local sessions in production and cross-origin sign-in, and partitions secure browser cookies',async()=>{
  const {generateLocalTelegramToken}=await import('../src/middleware/auth'),oldMode=config.nodeEnv;config.nodeEnv='production';
  try{expect((await call(`/api/library/${book.id}/pages/1`,generateLocalTelegramToken(reader.id))).status).toBe(401);expect((await call('/api/auth/login',undefined,{method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},body:'{}'})).status).toBe(403);
   const {sessionCookieOptions}=await import('../src/services/sessionService');expect(sessionCookieOptions()).toMatchObject({httpOnly:true,secure:true,sameSite:'none',partitioned:true});
   const cleared=await call('/api/auth/logout',undefined,{method:'POST'});expect(cleared.headers.get('set-cookie')).toContain('Partitioned');expect(cleared.headers.get('set-cookie')).toContain('HttpOnly');
  }finally{config.nodeEnv=oldMode;}
 });
 it('throttles bulk page extraction by account while leaving owners and content administrators uncapped',async()=>{
  const {generateToken}=await import('../src/middleware/auth'),scanner=await prisma.user.create({data:{telegramId:'fixture:security-scanner'}}),token=generateToken(scanner.id,scanner.telegramId);
  for(let index=0;index<90;index++){const response=await call(`/api/library/${book.id}/pages/1`,token);expect(response.status).toBe(200);await response.arrayBuffer();}
  const limited=await call(`/api/library/${book.id}/pages/1`,token);expect(limited.status).toBe(429);expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
  const helper=await prisma.user.create({data:{telegramId:'fixture:security-uncapped-helper',role:'ADMIN'}});
  for(const credential of [adminToken,generateToken(helper.id,helper.telegramId)])for(let index=0;index<95;index++){const response=await call(`/api/library/${book.id}/pages/1`,credential);expect(response.status).toBe(200);await response.arrayBuffer();}
 });
});
