import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import express from 'express';
import {Server} from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {execFileSync} from 'child_process';
import {config} from '../src/config';
import defaults from '../src/config/library-hero.json';

describe('Site section access and editable library hero',()=>{
  let server:Server,base:string,prisma:any,token:any,owner:any,reader:any,helper:any,book:any,audioId:string,coverId:string;
  const fixture=path.resolve(__dirname,'../../build/site-settings-'+crypto.randomUUID()),database=fixture+'.db',media=fixture+'-media';
  const saved={mediaDirectory:config.mediaDirectory,jwtSecret:config.jwtSecret,frontendUrl:config.frontendUrl,nodeEnv:config.nodeEnv};
  const call=(route:string,method='GET',body?:unknown,credential?:string)=>fetch(base+route,{method,redirect:'manual',headers:{...(body?{'Content-Type':'application/json'}:{}),...(credential?{Authorization:'Bearer '+credential}:{})},...(body?{body:JSON.stringify(body)}:{})});
  beforeAll(async()=>{
    fs.mkdirSync(path.dirname(database),{recursive:true});fs.writeFileSync(database,'');
    vi.stubEnv('DATABASE_URL','file:'+database.replace(/\\/g,'/'));
    execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.resolve(__dirname,'../prisma/schema.prisma')],{stdio:'pipe',env:process.env});
    config.mediaDirectory=media;config.jwtSecret=crypto.randomBytes(32).toString('hex');config.nodeEnv='test';
    prisma=(await import('../src/lib/prisma')).default;token=(await import('../src/middleware/auth')).generateToken;
    const routes=(await import('../src/routes')).default,{errorHandler}=await import('../src/middleware/errorHandler');
    const app=express();app.use(express.json());app.use('/api',routes);app.use(errorHandler);
    server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base='http://127.0.0.1:'+(server.address() as any).port;config.frontendUrl=base;
    owner=await prisma.user.create({data:{telegramId:'fixture:settings-owner',role:'OWNER'}});
    reader=await prisma.user.create({data:{telegramId:'fixture:settings-reader',role:'READER'}});
    helper=await prisma.user.create({data:{telegramId:'fixture:settings-admin',role:'ADMIN'}});
    fs.mkdirSync(media,{recursive:true});
    audioId=crypto.randomUUID();coverId=crypto.randomUUID();
    for(const [id,kind,mimeType] of [[audioId,'audio','audio/wav'],[coverId,'cover','image/png']]){
      fs.writeFileSync(path.join(media,id),Buffer.from('fixture media'));
      await prisma.mediaAsset.create({data:{id,kind,mimeType,filename:id,size:13,createdById:owner.id}});
    }
    book=await prisma.libraryBook.create({data:{title:'کتاب تنظیمات',status:'PUBLISHED',pages:{create:{number:1,heading:'تمرکز',content:'تمرکز در مطالعه',searchText:'تمرکز در مطالعه'}}}});
  },30000);
  beforeEach(async()=>{await prisma.siteSetting.deleteMany();await prisma.user.update({where:{id:helper.id},data:{role:'ADMIN'}});});
  afterAll(async()=>{
    Object.assign(config,saved);vi.unstubAllEnvs();
    if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));if(prisma)await prisma.$disconnect();
    for(const suffix of ['','-journal','-wal','-shm'])if(fs.existsSync(database+suffix))fs.unlinkSync(database+suffix);
    if(fs.existsSync(media)){for(const name of fs.readdirSync(media))fs.unlinkSync(path.join(media,name));fs.rmdirSync(media);}
  });
  it('defaults every section to enabled and restricts validated changes to current administrators',async()=>{
    const response=await call('/api/site/sections');expect(response.headers.get('cache-control')).toBe('no-store');expect((await response.json()).features).toEqual({library:true,search:true,store:true,profile:true});
    expect((await call('/api/admin/sections/store','PUT',{enabled:false})).status).toBe(401);
    expect((await call('/api/admin/sections/store','PUT',{enabled:false},token(reader.id,reader.telegramId))).status).toBe(403);
    const admin=token(owner.id,owner.telegramId);
    for(const [section,body] of [['admin',{enabled:false}],['store',{enabled:'false'}],['store',{enabled:false,role:'OWNER'}]])expect((await call('/api/admin/sections/'+section,'PUT',body,admin)).status).toBe(400);
    expect((await call('/api/admin/sections','GET',undefined,admin)).status).toBe(200);
  });
  it('persists separate switches without losing simultaneous changes',async()=>{
    const admin=token(owner.id,owner.telegramId);
    const responses=await Promise.all([call('/api/admin/sections/store','PUT',{enabled:false},admin),call('/api/admin/sections/search','PUT',{enabled:false},admin)]);
    expect(responses.map(response=>response.status)).toEqual([200,200]);
    expect((await (await call('/api/site/sections')).json()).features).toEqual({library:true,search:false,store:false,profile:true});
    expect(await prisma.siteSetting.count({where:{key:{startsWith:'section_enabled:'}}})).toBe(2);
    await call('/api/admin/sections/store','PUT',{enabled:true},admin);expect((await (await call('/api/site/sections')).json()).features.store).toBe(true);
  });
  it('blocks disabled library routes and files while checking administrator roles from the database',async()=>{
    const admin=token(owner.id,owner.telegramId),assistant=token(helper.id,helper.telegramId);
    await call('/api/admin/sections/library','PUT',{enabled:false},admin);
    for(const route of ['/api/library','/api/library/'+book.id,'/api/library/'+book.id+'/pages/1','/api/library/search?q='+encodeURIComponent('تمرکز'),'/api/library/progress','/api/media/'+audioId,'/api/media/'+coverId+'/pages/1/image']){
      const response=await call(route,'GET',undefined,token(reader.id,reader.telegramId));expect(response.status).toBe(403);expect((await response.json()).code).toBe('SECTION_DISABLED');
    }
    expect((await call('/api/library')).status).toBe(403);
    expect((await call('/api/library','GET',undefined,assistant)).status).toBe(200);
    await prisma.user.update({where:{id:helper.id},data:{role:'READER'}});
    expect((await call('/api/library','GET',undefined,assistant)).status).toBe(403);
    const forgedRole=jwt.sign({userId:reader.id,telegramId:reader.telegramId,role:'OWNER'},config.jwtSecret);
    expect((await call('/api/library','GET',undefined,forgedRole)).status).toBe(403);
    expect((await call('/api/library','GET',undefined,admin)).status).toBe(200);
    expect((await prisma.libraryBook.findUnique({where:{id:book.id}})).status).toBe('PUBLISHED');
    await call('/api/admin/sections/library','PUT',{enabled:true},admin);expect((await call('/api/library/'+book.id+'/pages/1','GET',undefined,admin)).status).toBe(200);
  });
  it('disables search independently and keeps authentication and payment callbacks reachable',async()=>{
    const admin=token(owner.id,owner.telegramId),viewer=token(reader.id,reader.telegramId);
    await call('/api/admin/sections/search','PUT',{enabled:false},admin);
    expect((await call('/api/library')).status).toBe(200);expect((await call('/api/library/search?q=topic')).status).toBe(403);
    await call('/api/admin/sections/profile','PUT',{enabled:false},admin);
    expect((await call('/api/users/profile','GET',undefined,viewer)).status).toBe(403);
    expect((await call('/api/users/profile','PUT',{firstName:'Reader'},viewer)).status).toBe(403);
    expect((await call('/api/auth/session','GET',undefined,viewer)).status).toBe(200);
    await call('/api/admin/sections/store','PUT',{enabled:false},admin);
    for(const [route,method] of [['/api/books/info','GET'],['/api/orders','GET'],['/api/orders','POST'],['/api/payments/initiate','POST']])expect((await call(route,method,method==='POST'?{}:undefined,viewer)).status).toBe(403);
    expect((await call('/api/payments/callback')).status).not.toBe(403);
    await call('/api/admin/sections/library','PUT',{enabled:false},admin);
    expect((await call('/api/auth/options')).status).toBe(200);expect((await call('/api/admin/sections','GET',undefined,admin)).status).toBe(200);
  });
  it('saves editable hero text and rejects unknown fields, excessive text, and invalid media selections',async()=>{
    const admin=token(owner.id,owner.telegramId);
    const hero={...defaults,kicker:'فصل تازهٔ کتابخانه',titleLines:['بخوان','بشنو','کشف کن']};
    expect((await call('/api/admin/library-hero','PUT',hero,token(reader.id,reader.telegramId))).status).toBe(403);
    expect((await call('/api/admin/library-hero','PUT',hero,admin)).status).toBe(200);
    expect((await (await call('/api/site/library-hero')).json()).hero.kicker).toBe(hero.kicker);
    for(const bad of [{...hero,kicker:'a'.repeat(161)},{...hero,frontImageAssetId:'https://external.test/cover.jpg'},{...hero,audioMode:'UPLOAD',audioAssetId:coverId},{...hero,frontImageAssetId:audioId},{...hero,stories:[]},{...hero,role:'OWNER'}])expect((await call('/api/admin/library-hero','PUT',bad,admin)).status).toBe(400);
    expect((await (await call('/api/site/library-hero')).json()).hero).toEqual(hero);
  });
  it('publishes dedicated hero assets only after saving and removes public access when deselected',async()=>{
    const admin=token(owner.id,owner.telegramId);
    expect((await call('/api/media/'+audioId)).status).toBe(404);
    expect((await call('/api/media/'+coverId)).status).toBe(404);
    expect((await call('/api/media/'+audioId,'GET',undefined,admin)).status).toBe(200);
    const hero={...defaults,audioMode:'UPLOAD',audioAssetId:audioId,frontImageAssetId:coverId};
    expect((await call('/api/admin/library-hero','PUT',hero,admin)).status).toBe(200);
    expect((await call('/api/media/'+audioId)).status).toBe(401);
    const viewer=token(reader.id,reader.telegramId),sample=(await(await call('/api/site/library-hero/audio','GET',undefined,viewer)).json()).url;
    const response=await call(sample,'GET',undefined,viewer);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');
    expect((await call('/api/media/'+coverId)).status).toBe(200);
    await call('/api/admin/library-hero','PUT',{...hero,audioMode:'OFF',bookVisible:false},admin);
    expect((await call('/api/media/'+audioId)).status).toBe(404);expect((await call('/api/media/'+coverId)).status).toBe(404);
  });
  it('accepts only an uploaded narration on a published page for a fixed hero sample',async()=>{
    const admin=token(owner.id,owner.telegramId),hero={...defaults,audioMode:'PAGE',audioBookId:book.id,audioPageNumber:1};
    expect((await call('/api/admin/library-hero','PUT',hero,admin)).status).toBe(400);
    await prisma.libraryPage.update({where:{bookId_number:{bookId:book.id,number:1}},data:{audioAssetId:audioId}});
    expect((await call('/api/admin/library-hero','PUT',hero,admin)).status).toBe(200);
    await prisma.libraryBook.update({where:{id:book.id},data:{status:'HIDDEN'}});
    expect((await call('/api/admin/library-hero','PUT',hero,admin)).status).toBe(400);
  });
});
