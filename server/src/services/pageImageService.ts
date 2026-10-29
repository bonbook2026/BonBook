import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {execFile} from 'child_process';
import {promisify} from 'util';
import {config} from '../config';
import {HttpError} from '../lib/httpError';
const exec=promisify(execFile),pending=new Map<string,Promise<string>>();let tail:Promise<unknown>=Promise.resolve();
export async function pdfPageImage(id:string,filename:string,number:number){
 const directory=path.resolve(config.mediaDirectory,'../page-previews'),key=id+'-'+number,destination=path.join(directory,key+'.png');
 try{await fs.access(destination);return destination;}catch{}
 const existing=pending.get(key);if(existing)return existing;
 if(pending.size>=8)throw new HttpError(503,'تصویر در حال آماده‌شدن است؛ چند لحظه بعد دوباره باز کنید.');
 const task=tail.catch(()=>{}).then(async()=>{
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'bonbook-page-')),prefix=path.join(temporary,crypto.randomUUID()),staged=path.join(directory,key+'-'+crypto.randomUUID()+'.tmp');
  try{await fs.mkdir(directory,{recursive:true,mode:0o700});await exec(process.env.BONBOOK_PDFTOPPM||'pdftoppm',['-f',String(number),'-l',String(number),'-singlefile','-scale-to','1600','-png',path.join(config.mediaDirectory,filename),prefix],{timeout:45000,maxBuffer:100000,env:{...process.env,OMP_THREAD_LIMIT:'1'}});await fs.copyFile(prefix+'.png',staged);await fs.chmod(staged,0o600);await fs.rename(staged,destination);return destination;}
  catch{throw new HttpError(422,'تصویر این صفحه آماده نشد؛ چند لحظه بعد دوباره تلاش کنید.');}
  finally{await fs.unlink(prefix+'.png').catch(()=>{});await fs.unlink(staged).catch(()=>{});await fs.rmdir(temporary).catch(()=>{});}
 });pending.set(key,task);tail=task;try{return await task;}finally{pending.delete(key);}
}
