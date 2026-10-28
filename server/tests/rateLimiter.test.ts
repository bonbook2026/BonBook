import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import express from 'express';
import {Server} from 'http';
import jwt from 'jsonwebtoken';
import {config} from '../src/config';
import {generalLimiter} from '../src/middleware/rateLimiter';
const {roles}=vi.hoisted(()=>({roles:new Map<number,string>([[11,'READER'],[12,'READER'],[13,'ADMIN'],[14,'OWNER']])}));
vi.mock('../src/lib/prisma',()=>({default:{user:{findUnique:vi.fn(async({where}:{where:{id:number}})=>({role:roles.get(where.id)||'READER'}))}}}));

describe('BonBook API rate limits',()=>{
  let server:Server,base:string;const secret=config.jwtSecret;
  const token=(id:number,extra={})=>jwt.sign({userId:id,telegramId:'fixture:'+id,...extra},config.jwtSecret,{expiresIn:'1h'});
  const get=(path:string,bearer?:string)=>fetch(base+path,{headers:bearer?{Authorization:'Bearer '+bearer}:{}});
  const many=async(count:number,bearer?:string)=>{
    const statuses:number[]=[];
    for(let offset=0;offset<count;offset+=25){const batch=await Promise.all(Array.from({length:Math.min(25,count-offset)},async()=>{const response=await get('/api/check',bearer);await response.text();return response.status;}));statuses.push(...batch);}
    return statuses;
  };
  beforeAll(async()=>{
    config.jwtSecret='rate-limit-fixture-secret-at-least-32-characters';
    const app=express();app.get('/api/health',(_req,res)=>res.json({ok:true}));app.use('/api',generalLimiter);app.get('/api/check',(_req,res)=>res.json({ok:true}));app.get('/admin',(_req,res)=>res.type('html').send('<h1>BonBook</h1>'));app.get('/assets/cover.jpg',(_req,res)=>res.send('fixture'));
    server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base='http://127.0.0.1:'+(server.address() as any).port;
  });
  afterAll(async()=>{config.jwtSecret=secret;if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));});
  it('keeps HTML, images and health available after an anonymous API limit is exhausted',async()=>{
    expect((await many(100)).every(status=>status===200)).toBe(true);
    const denied=await get('/api/check');expect(denied.status).toBe(429);expect(Number(denied.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await get('/admin')).status).toBe(200);expect((await get('/assets/cover.jpg')).status).toBe(200);expect((await get('/api/health')).status).toBe(200);
    expect((await get('/api/check','forged-arbitrary-token')).status).toBe(429);
  });
  it('gives valid reader accounts isolated budgets and ignores role text in tokens',async()=>{
    const reader=token(11,{role:'OWNER'});expect((await many(600,reader)).every(status=>status===200)).toBe(true);
    expect((await get('/api/check',reader)).status).toBe(429);expect((await get('/api/check',token(12))).status).toBe(200);
  },15000);
  it('does not cap verified administrators and applies a revoked role on the next request',async()=>{
    const admin=token(13);expect((await many(625,admin)).every(status=>status===200)).toBe(true);
    expect((await get('/api/check',token(14))).headers.get('ratelimit-limit')).toBeNull();
    roles.set(13,'READER');const downgraded=await get('/api/check',admin);expect(downgraded.status).toBe(200);expect(downgraded.headers.get('ratelimit-limit')).toBe('600');
  },15000);
});
