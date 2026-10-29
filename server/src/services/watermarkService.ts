import fs from 'fs/promises';
import sharp from 'sharp';
import {HttpError} from '../lib/httpError';
sharp.concurrency(1);sharp.cache({memory:16,items:20,files:0});
const cached=new Map<string,{buffer:Buffer;expires:number}>(),pending=new Map<string,Promise<Buffer>>();let bytes=0;
export async function watermarkedImage(filename:string,code:string){
 if(!/^BB-[0-9A-Z]+-[0-9A-F]{8}$/.test(code))throw new Error('Invalid watermark identifier');
 const stat=await fs.stat(filename),key=filename+':'+stat.mtimeMs+':'+code,hit=cached.get(key);
 if(hit&&hit.expires>Date.now()){cached.delete(key);cached.set(key,hit);return hit.buffer;}
 if(hit){bytes-=hit.buffer.length;cached.delete(key);}const existing=pending.get(key);if(existing)return existing;
 if(pending.size>=8)throw new HttpError(503,'تصویرهای محافظت‌شده در حال آماده‌شدن هستند؛ کمی بعد دوباره تلاش کنید.');
 const task=(async()=>{
  const input=await sharp(filename,{limitInputPixels:25_000_000}).rotate().resize({width:1600,height:2000,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
  const {width,height}=input.info,size=Math.max(12,Math.round(width/70));
  const marks=[.2,.48,.76].flatMap(y=>[.25,.72].map(x=>`<text x="${width*x}" y="${height*y}" transform="rotate(-24 ${width*x} ${height*y})" text-anchor="middle">BonBook · ${code}</text>`)).join('');
  const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="sans-serif" font-size="${size}" fill="#284a55" opacity=".18">${marks}</g><text x="${width-14}" y="${height-14}" text-anchor="end" font-family="sans-serif" font-size="${Math.max(10,Math.round(size*.65))}" fill="#284a55" opacity=".65">BonBook · ${code}</text></svg>`);
  const buffer=await sharp(input.data).composite([{input:overlay}]).png({compressionLevel:6}).toBuffer();
  if(buffer.length<=8*1024*1024){while(cached.size&&bytes+buffer.length>32*1024*1024){const oldest=cached.keys().next().value!;bytes-=cached.get(oldest)!.buffer.length;cached.delete(oldest);}cached.set(key,{buffer,expires:Date.now()+10*60_000});bytes+=buffer.length;}
  return buffer;
 })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
