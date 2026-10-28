import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {spawn} from 'child_process';
import {config} from '../config';
import prisma from '../lib/prisma';
import {HttpError} from '../lib/httpError';
export const contentHash=(content:string)=>crypto.createHash('sha256').update(content).digest('hex');
export const speechPaths=()=>({python:process.env.BONBOOK_SPEECH_PYTHON||'/srv/bonbook-preproduction/shared/speech-venv/bin/python',model:process.env.BONBOOK_SPEECH_MODEL||'/srv/bonbook-preproduction/shared/speech-models/small',script:path.resolve(__dirname,'../../speech/transcribe.py')});
export async function speechAvailable(){try{const files=speechPaths();await Promise.all([fs.access(files.python),fs.access(path.join(files.model,'model.bin')),fs.access(files.script)]);return true;}catch{return false;}}
export function readingLines(text:string){
 const result:{start:number;end:number;text:string}[]=[];
 for(const block of text.matchAll(/[^\n]+/g))for(const sentence of block[0].matchAll(/[^.!?؟؛]+[.!?؟؛]*|[.!?؟؛]+/g)){
  let rest=sentence[0],offset=block.index!+sentence.index!;
  while(rest.length){let length=Math.min(160,rest.length);if(length<rest.length){const space=rest.lastIndexOf(' ',length);if(space>60)length=space+1;}const raw=rest.slice(0,length),leading=raw.length-raw.trimStart().length,value=raw.trim();if(value)result.push({start:offset+leading,end:offset+leading+value.length,text:value});offset+=length;rest=rest.slice(length);}
 }
 return result;
}
export async function queueAlignment(tx:any,page:any,userId:number){
 if(!page.audioAssetId||!page.content.trim())throw new HttpError(400,'ابتدا متن و ویس این صفحه را ذخیره کنید.');
 const hash=contentHash(page.content),existing=await tx.audioAlignment.findFirst({where:{pageId:page.id,audioAssetId:page.audioAssetId,contentHash:hash,status:{in:['QUEUED','PROCESSING']}},orderBy:{createdAt:'desc'}});
 if(existing)return existing;
 return tx.audioAlignment.create({data:{id:crypto.randomUUID(),pageId:page.id,audioAssetId:page.audioAssetId,contentHash:hash,previousCues:page.audioCues,createdById:userId}});
}
export const alignmentJson=(job:any)=>({id:job.id,pageNumber:job.page?.number,bookId:job.page?.bookId,status:job.status,progress:job.progress,coverage:job.coverage,lineCoverage:job.lineCoverage,duration:job.duration,warning:job.warning,error:job.error,cues:JSON.parse(job.cues),candidates:JSON.parse(job.candidates),createdAt:job.createdAt});
export async function recognizeSpeech(job:any,onProgress:(progress:number)=>Promise<void>,canceled:()=>Promise<boolean>){
 const files=speechPaths(),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'bonbook-speech-')),input=path.join(temporary,'request.json'),output=path.join(temporary,'result.json');
 try{
  await fs.writeFile(input,JSON.stringify({audio:path.join(config.mediaDirectory,job.audio.filename),model:files.model,output,text:job.page.content,lines:readingLines(job.page.content),language:job.page.book.language.startsWith('en')?'en':job.page.book.language.startsWith('ar')?'ar':'fa'}),{mode:0o600});
  await new Promise<void>((resolve,reject)=>{
   const child=spawn(files.python,[files.script,input],{env:{...process.env,HF_HUB_OFFLINE:'1',OMP_NUM_THREADS:'2'},stdio:['ignore','pipe','pipe']});let buffer='',error='',last=0,settled=false;
   const finish=(failure?:Error)=>{if(settled)return;settled=true;clearInterval(check);clearTimeout(timeout);if(failure)reject(failure);else resolve();};
   const check=setInterval(()=>{void canceled().then(value=>{if(value){child.kill('SIGKILL');finish(new Error('پردازش لغو شد.'));}}).catch(()=>{});},2000);
   const timeout=setTimeout(()=>{child.kill('SIGKILL');finish(new Error('پردازش بیش از دو ساعت طول کشید؛ ویس را به بخش‌های کوتاه‌تر تقسیم کنید.'));},7200_000);
   child.stdout.on('data',data=>{buffer+=data.toString();let end:number;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const event=JSON.parse(line);if(event.error)error=event.error;if(typeof event.progress==='number'&&Date.now()-last>4000){last=Date.now();void onProgress(Math.min(.99,Math.max(0,event.progress))).catch(()=>{});}}catch{}}if(buffer.length>10000)buffer='';});
   child.stderr.on('data',data=>{if(error.length<2000)error+=data.toString().slice(0,1000);});
   child.once('error',()=>finish(new Error('موتور تشخیص گفتار روی سرور آماده نیست.')));child.once('close',code=>finish(code===0?undefined:new Error(error.includes('مدت فایل')?error.slice(0,300):'تشخیص گفتار انجام نشد؛ قالب یا کیفیت فایل را بررسی کنید.')));
  });
  const data=await fs.readFile(output,'utf8');if(data.length>8_000_000)throw new Error('نتیجهٔ گفتار بیش از حد بزرگ است.');return JSON.parse(data);
 }finally{for(const name of ['request.json','result.json'])await fs.unlink(path.join(temporary,name)).catch(()=>{});await fs.rmdir(temporary).catch(()=>{});}
}
export async function applyAlignment(id:string,force=false){return prisma.$transaction(async tx=>{
 const job=await tx.audioAlignment.findUnique({where:{id},include:{page:{include:{book:true}}}});if(!job)throw new HttpError(404,'پردازش پیدا نشد.');if(job.status==='APPLIED')return job;
 if(!['REVIEW','READY'].includes(job.status)||!JSON.parse(job.cues).length)throw new HttpError(409,'زمان‌بندی آمادهٔ اعمال نیست.');
 if(job.page.book.status==='TRASH'||job.page.audioAssetId!==job.audioAssetId||contentHash(job.page.content)!==job.contentHash)throw new HttpError(409,'متن یا ویس صفحه عوض شده است؛ دوباره تشخیص گفتار را اجرا کنید.');
 if(!force&&job.page.audioCues!==job.previousCues)throw new HttpError(409,'زمان‌بندی دستی در این فاصله تغییر کرده است. پیشنهادها را بازبینی کنید.');
 await tx.libraryPage.update({where:{id:job.pageId},data:{audioCues:job.cues,audioCueMode:job.lineCoverage===1?'AUTO':'PARTIAL'}});
 return tx.audioAlignment.update({where:{id},data:{status:'APPLIED',progress:1}});
 });}
