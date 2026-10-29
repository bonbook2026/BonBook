import {it,expect} from 'vitest';
import express from 'express';
import {Server} from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {installClientRoutes} from '../src/clientRoutes';

it('serves direct admin settings links and reader refreshes without treating API or unknown paths as client routes',async()=>{
  const directory=path.resolve(__dirname,'../../build/client-routes-'+crypto.randomUUID());
  fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'index.html'),'<html>BonBook fixture</html>');fs.writeFileSync(path.join(directory,'.env'),'fixture-only');
  let server:Server|undefined;
  try{
    const app=express();installClientRoutes(app,directory);
    server=await new Promise<Server>(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});
    const base='http://127.0.0.1:'+(server.address() as any).port;
    for(const route of ['/admin/sections','/admin/content-security','/admin/library-hero','/admin/library-hero/','/admin/books/5','/library','/read/5/10']){
      const response=await fetch(base+route);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.text()).toContain('BonBook fixture');
    }
    for(const route of ['/api/site/sections','/admin/unknown','/.env'])expect((await fetch(base+route)).status).not.toBe(200);
  }finally{
    if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
    fs.unlinkSync(path.join(directory,'index.html'));fs.unlinkSync(path.join(directory,'.env'));fs.rmdirSync(directory);
  }
});
