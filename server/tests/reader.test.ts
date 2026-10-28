import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import express from 'express';
import { Server } from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../src/config';

describe('Reader, verified identities and administration',()=>{
  let server:Server,base:string,prisma:any,applyVerifiedAccess:any,generateToken:any,owner:any,reader:any,helper:any,book:any;
  const fixture=path.resolve(__dirname,'../../build/reader-'+crypto.randomUUID()),database=fixture+'.db';
  const saved={owners:config.owners,google:config.google,mediaDirectory:config.mediaDirectory,jwtSecret:config.jwtSecret,frontendUrl:config.frontendUrl,nodeEnv:config.nodeEnv};
  const call=(route:string,method='GET',body?:unknown,token?:string)=>fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  beforeAll(async()=>{
    fs.mkdirSync(path.dirname(database),{recursive:true});
    fs.writeFileSync(database,'');
    vi.stubEnv('DATABASE_URL','file:'+database.replace(/\\/g,'/'));
    execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.resolve(__dirname,'../prisma/schema.prisma')],{stdio:'pipe',env:process.env});
    config.owners={telegramUsername:'fixture_owner',googleEmails:['fixture-owner@gmail.com']};
    config.google={clientId:'fixture-client.apps.googleusercontent.com',clientSecret:'fixture-secret'};
    config.mediaDirectory=fixture+'-media';config.jwtSecret=crypto.randomBytes(32).toString('hex');config.nodeEnv='test';
    prisma=(await import('../src/lib/prisma')).default;
    ({applyVerifiedAccess}=await import('../src/services/accessService'));
    ({generateToken}=await import('../src/middleware/auth'));
    const routes=(await import('../src/routes')).default,{errorHandler}=await import('../src/middleware/errorHandler');
    const app=express();app.use(express.json());app.use('/api',routes);app.use(errorHandler);
    server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});
    base='http://127.0.0.1:'+(server.address() as any).port;config.frontendUrl=base;
    owner=await prisma.user.create({data:{telegramId:'fixture:owner'}});
    owner=await applyVerifiedAccess(owner.id,{telegramId:'600001',username:'fixture_owner'});
    reader=await prisma.user.create({data:{telegramId:'fixture:reader',firstName:'Reader',lastName:'Fixture',email:'reader@example.com'}});
    helper=await prisma.user.create({data:{telegramId:'fixture:helper'}});
  },30000);
  afterAll(async()=>{
    vi.restoreAllMocks();Object.assign(config,saved);vi.unstubAllEnvs();
    if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
    if(prisma)await prisma.$disconnect();
    for(const suffix of ['','-journal','-wal','-shm'])if(fs.existsSync(database+suffix))fs.unlinkSync(database+suffix);
    if(fs.existsSync(fixture+'-media')){for(const name of fs.readdirSync(fixture+'-media'))fs.unlinkSync(path.join(fixture+'-media',name));fs.rmdirSync(fixture+'-media');}
  });
  it('pins the first verified Telegram owner and rejects editable profile privileges',async()=>{
    expect(owner.role).toBe('OWNER');
    expect((await applyVerifiedAccess(reader.id,{telegramId:'600002',username:'fixture_owner'})).role).toBe('READER');
    const response=await call('/api/users/profile','PUT',{email:'fixture-owner@gmail.com',role:'OWNER'},generateToken(reader.id,reader.telegramId));
    expect(response.status).toBe(200);
    expect((await call('/api/admin/books','GET',undefined,generateToken(reader.id,reader.telegramId))).status).toBe(403);
  });
  it('requires a claimed invitation and revokes helper administration immediately',async()=>{
    const ownerToken=generateToken(owner.id,owner.telegramId),helperToken=generateToken(helper.id,helper.telegramId);
    const invitation=await (await call('/api/admin/access','POST',{identifier:'@fixture_helper'},ownerToken)).json();
    expect(invitation.grant.claimedUserId).toBeNull();
    expect((await call('/api/admin/books','GET',undefined,helperToken)).status).toBe(403);
    await applyVerifiedAccess(helper.id,{telegramId:'600003',username:'fixture_helper'});
    expect((await call('/api/admin/books','GET',undefined,helperToken)).status).toBe(200);
    expect((await call('/api/admin/access','POST',{identifier:'@another_admin'},helperToken)).status).toBe(403);
    expect((await call('/api/admin/access/'+invitation.grant.id,'DELETE',undefined,ownerToken)).status).toBe(200);
    expect((await call('/api/admin/books','GET',undefined,helperToken)).status).toBe(403);
  });
  it('keeps drafts private, validates uploads, publishes actual searchable pages and records progress',async()=>{
    const token=generateToken(owner.id,owner.telegramId);
    book=(await (await call('/api/admin/books','POST',{title:'کتاب آزمایش'},token)).json()).book;
    expect((await call('/api/library/'+book.id)).status).toBe(404);
    expect((await call('/api/admin/books/'+book.id,'PUT',{...book,status:'PUBLISHED'},token)).status).toBe(400);
    const file=new FormData();file.append('file',new Blob(['<svg><script>bad()</script></svg>'],{type:'image/png'}),'cover.png');
    expect((await fetch(base+'/api/admin/media/cover',{method:'POST',headers:{Authorization:'Bearer '+token},body:file})).status).toBe(400);
    const wav=Buffer.alloc(44);wav.write('RIFF');wav.writeUInt32LE(36,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);
    const audio=new FormData();audio.append('file',new Blob([wav],{type:'audio/wav'}),'page.wav');
    const uploaded=await (await fetch(base+'/api/admin/media/audio',{method:'POST',headers:{Authorization:'Bearer '+token},body:audio})).json();
    expect(uploaded.asset.id).toMatch(/^[0-9a-f-]+$/);
    expect((await call(uploaded.asset.url)).status).toBe(404);
    await call('/api/admin/books/'+book.id+'/pages/7','PUT',{heading:'تمرکز موقع مطالعه',content:'برای تمرکز، تلفن را کنار بگذار و کتاب را بخوان.',keywords:'حواس‌پرتی',audioAssetId:uploaded.asset.id},token);
    expect((await (await call('/api/library/search?q='+encodeURIComponent('تمرکز'))).json()).results).toHaveLength(0);
    const published=await call('/api/admin/books/'+book.id,'PUT',{...book,status:'PUBLISHED'},token);expect(published.status).toBe(200);
    const results=(await (await call('/api/library/search?q='+encodeURIComponent('درباره تمركز از کتاب پیدا کن'))).json()).results;
    expect(results[0]).toMatchObject({bookId:book.id,number:7,heading:'تمرکز موقع مطالعه'});expect(results[0].content).toContain('تلفن');
    expect((await call(uploaded.asset.url)).status).toBe(200);
    const readerToken=generateToken(reader.id,reader.telegramId);
    expect((await call('/api/library/progress','PUT',{bookId:book.id,pageNumber:7},readerToken)).status).toBe(200);
    expect((await (await call('/api/library/progress','GET',undefined,readerToken)).json()).progress[0].pageNumber).toBe(7);
    expect((await call('/api/library/progress','PUT',{bookId:book.id,pageNumber:8},readerToken)).status).toBe(404);
  });
  it('binds Google login to PKCE, state and a verified ID token, then rejects replay',async()=>{
    const start=await fetch(base+'/api/auth/google/start?next=/admin',{redirect:'manual'});
    const authorization=new URL(start.headers.get('location')!),state=authorization.searchParams.get('state')!,cookie=start.headers.get('set-cookie')!.split(';')[0];
    expect(authorization.searchParams.get('scope')).toBe('openid email profile');expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
    const attempt=await prisma.oAuthAttempt.findUnique({where:{stateHash:crypto.createHash('sha256').update(state).digest('hex')}});
    const exchange=vi.spyOn(OAuth2Client.prototype,'getToken').mockResolvedValue({tokens:{id_token:'fixture-id-token'}} as any);
    vi.spyOn(OAuth2Client.prototype,'verifyIdToken').mockResolvedValue({getPayload:()=>({sub:'fixture-google-sub',email:'fixture-owner@gmail.com',email_verified:true,nonce:attempt.nonce})} as any);
    const response=await fetch(base+'/api/auth/google/callback?state='+state+'&code=fixture-code',{headers:{Cookie:cookie},redirect:'manual'});
    expect(response.status).toBe(302);expect(response.headers.get('location')).toBe(base+'/auth/complete?next=%2Fadmin');
    expect(exchange).toHaveBeenCalledWith(expect.objectContaining({codeVerifier:attempt.verifier}));
    const googleOwner=await prisma.authIdentity.findUnique({where:{provider_subject:{provider:'google',subject:'fixture-google-sub'}},include:{user:true}});expect(googleOwner.user.role).toBe('OWNER');
    const replay=await fetch(base+'/api/auth/google/callback?state='+state+'&code=fixture-code',{headers:{Cookie:cookie},redirect:'manual'});expect(replay.headers.get('location')).toContain('google_failed');expect(exchange).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
  it('persists full-cover geometry and rejects overlapping or invalid cover regions',async()=>{
    const token=generateToken(owner.id,owner.telegramId);
    const saved=await call('/api/admin/books/'+book.id,'PUT',{...book,status:'PUBLISHED',coverLayout:'SPREAD',coverFrontSide:'LEFT',coverSpineStart:47.5,coverSpineEnd:52.5},token);
    expect(saved.status).toBe(200);
    expect((await (await call('/api/library/'+book.id)).json()).book).toMatchObject({coverLayout:'SPREAD',coverFrontSide:'LEFT',coverSpineStart:47.5,coverSpineEnd:52.5});
    for(const data of [{coverSpineStart:70,coverSpineEnd:30},{coverSpineStart:5,coverSpineEnd:52},{coverFrontSide:'INVALID'},{coverLayout:'HTML'}]){
      expect((await call('/api/admin/books/'+book.id,'PUT',{...book,...data},token)).status).toBe(400);
    }
  });
  it('rejects wrong Google nonce and cross-site cookie mutations',async()=>{
    const start=await fetch(base+'/api/auth/google/start',{redirect:'manual'}),authorization=new URL(start.headers.get('location')!),state=authorization.searchParams.get('state')!,cookie=start.headers.get('set-cookie')!.split(';')[0];
    vi.spyOn(OAuth2Client.prototype,'getToken').mockResolvedValue({tokens:{id_token:'fixture-id-token'}} as any);
    vi.spyOn(OAuth2Client.prototype,'verifyIdToken').mockResolvedValue({getPayload:()=>({sub:'bad-sub',email:'fixture-owner@gmail.com',email_verified:true,nonce:'wrong'})} as any);
    const response=await fetch(base+'/api/auth/google/callback?state='+state+'&code=fixture-code',{headers:{Cookie:cookie},redirect:'manual'});expect(response.headers.get('location')).toContain('google_failed');
    expect(await prisma.authIdentity.count({where:{subject:'bad-sub'}})).toBe(0);
    const denied=await fetch(base+'/api/admin/books',{method:'POST',headers:{Cookie:'bonbook_session='+generateToken(owner.id,owner.telegramId),Origin:'https://attacker.invalid','Content-Type':'application/json'},body:JSON.stringify({title:'forged'})});expect(denied.status).toBe(403);
    vi.restoreAllMocks();
  });
  it('stages a whole document, previews it, and applies its pages without overwriting existing text',async()=>{
    const token=generateToken(owner.id,owner.telegramId),form=new FormData();
    form.append('mode','text');form.append('files',new Blob([Array.from({length:40},()=> 'یادگیری و مطالعه با تمرکز. '.repeat(10)).join('\n\n')],{type:'text/plain'}),'sample.txt');
    const upload=await fetch(base+'/api/admin/media/import/'+book.id,{method:'POST',headers:{Authorization:'Bearer '+token},body:form});expect(upload.status).toBe(202);
    const {import:job}=await upload.json();expect(job.status).toBe('QUEUED');
    expect((await call('/api/admin/imports/'+job.id,'GET',undefined,generateToken(reader.id,reader.telegramId))).status).toBe(403);
    const stored=await prisma.bookImport.findUnique({where:{id:job.id}}),source=JSON.parse(stored.sources)[0];
    const {extractDocument}=await import('../src/services/documentExtraction');
    await extractDocument(source,config.mediaDirectory,'text',async totalPages=>{await prisma.bookImport.update({where:{id:job.id},data:{totalPages}});},async page=>{await prisma.importedPage.create({data:{...page,importId:job.id}});},async()=>false);
    await prisma.bookImport.update({where:{id:job.id},data:{status:'REVIEW'}});
    const preview=await call('/api/admin/imports/'+job.id+'/pages/1','GET',undefined,token);expect(preview.status).toBe(200);expect((await preview.json()).page.content).toContain('یادگیری');
    expect((await call('/api/admin/imports/'+job.id+'/apply','POST',{startPage:7},token)).status).toBe(409);
    const applied=await call('/api/admin/imports/'+job.id+'/apply','POST',{startPage:10},token);expect(applied.status).toBe(200);expect((await applied.json()).added).toBeGreaterThan(2);
    expect((await (await call('/api/library/'+book.id+'/pages/7')).json()).page.content).toContain('تلفن');
    expect((await (await call('/api/library/'+book.id+'/pages/10')).json()).page.sourceUrl).toBe('/api/media/'+source.id);
    expect((await (await call('/api/admin/imports/'+job.id+'/apply','POST',{startPage:10},token)).json()).added).toBe(0);
  });
  it('organizes nested categories and supports reversible hide, archive and trash',async()=>{
    const token=generateToken(owner.id,owner.telegramId);
    const parent=(await (await call('/api/admin/categories','POST',{name:'موضوع اصلی'},token)).json()).category;
    const category=(await (await call('/api/admin/categories','POST',{name:'زیرموضوع',parentId:parent.id},token)).json()).category;
    expect((await call('/api/admin/categories/'+parent.id,'PUT',{name:'موضوع اصلی',parentId:category.id},token)).status).toBe(400);
    const current=(await (await call('/api/admin/books/'+book.id,'GET',undefined,token)).json()).book;
    expect((await call('/api/admin/books/'+book.id,'PUT',{...current,categoryId:category.id,tags:'یادگیری، نمونه'},token)).status).toBe(200);
    const found=await (await call('/api/admin/books?q='+encodeURIComponent('یادگیری')+'&categoryId='+category.id,'GET',undefined,token)).json();expect(found.books.some((item:any)=>item.id===book.id)).toBe(true);
    const parentFound=await (await call('/api/admin/books?categoryId='+parent.id,'GET',undefined,token)).json();expect(parentFound.books.some((item:any)=>item.id===book.id)).toBe(true);
    expect((await call('/api/admin/categories/'+category.id,'DELETE',undefined,token)).status).toBe(409);
    const before=await prisma.libraryPage.count({where:{bookId:book.id}});
    for(const action of ['hide','archive','trash']){expect((await call('/api/admin/books/'+book.id+'/state','POST',{action},token)).status).toBe(200);expect((await call('/api/library/'+book.id)).status).toBe(404);}
    expect(await prisma.libraryPage.count({where:{bookId:book.id}})).toBe(before);
    expect((await call('/api/admin/books/'+book.id+'/pages/99','PUT',{heading:'x',content:'text',keywords:''},token)).status).toBe(404);
    expect((await call('/api/admin/books?status=TRASH','GET',undefined,token)).status).toBe(200);
    const restored=await (await call('/api/admin/books/'+book.id+'/state','POST',{action:'restore'},token)).json();expect(restored.book.status).toBe('HIDDEN');expect(restored.book.deletedAt).toBeNull();
    expect((await call('/api/admin/books/'+book.id+'/state','POST',{action:'publish'},token)).status).toBe(200);
    expect((await call('/api/library/'+book.id)).status).toBe(200);
  });
});
