import fs from 'fs/promises';
import sync from 'fs';
import path from 'path';
import crypto from 'crypto';
import {Transform} from 'stream';
import {pipeline} from 'stream/promises';
import * as yauzl from 'yauzl';
import sharp from 'sharp';
import {config} from '../config';
import {HttpError} from '../lib/httpError';
import {detectMedia} from './mediaService';
const schema=require('../../../shared/illustrated-package.cjs');
export const PACKAGE_CHUNK=8*1024*1024,MAX_PACKAGE=1024*1024*1024;
export interface PackageAsset{path:string;size:number;sha256:string;id:string;filename:string;mimeType:string;kind:string}
export interface PackagePage{number:number;heading:string;content:string;image:string|null;audio:string|null;audioCues:{time:number;offset:number}[]}
export interface PackageManifest{format:string;version:number;book:{title:string;author:string;description:string;language:string};pages:PackagePage[];assets:PackageAsset[]}
export const packageRoot=()=>path.resolve(config.mediaDirectory,'../illustrated-incoming');
export function packageDirectory(id:string){if(!/^[a-f0-9-]{36}$/.test(id)||!/[a-f0-9]/.test(id))throw new HttpError(400,'شناسهٔ بسته معتبر نیست.');return path.join(packageRoot(),id);}
export async function removePackageDirectory(id:string){const directory=path.resolve(packageDirectory(id));if(path.dirname(directory)!==packageRoot())throw Error('Unsafe package path');await fs.rm(directory,{recursive:true,force:true});}
const running=new Set<string>();
export async function packageLock<T>(id:string,work:()=>Promise<T>){if(running.has(id))throw new HttpError(409,'کار دیگری روی این بسته در جریان است؛ چند لحظه بعد تلاش کن.');running.add(id);try{return await work();}finally{running.delete(id);}}
export async function receivedChunks(id:string,size:number){const directory=packageDirectory(id),result:number[]=[];for(let i=0;i<Math.ceil(size/PACKAGE_CHUNK);i++){const stat=await fs.stat(path.join(directory,`chunk-${i}`)).catch(()=>null);if(stat?.isFile()&&stat.size===Math.min(PACKAGE_CHUNK,size-i*PACKAGE_CHUNK))result.push(i);}return result;}
async function zipFile(file:string){return new Promise<yauzl.ZipFile>((resolve,reject)=>yauzl.open(file,{lazyEntries:true,autoClose:false,validateEntrySizes:true},(error,zip)=>error||!zip?reject(new HttpError(400,'ساختار ZIP معتبر نیست.')):resolve(zip)));}
async function entries(zip:yauzl.ZipFile){return new Promise<Map<string,yauzl.Entry>>((resolve,reject)=>{const result=new Map<string,yauzl.Entry>();let size=0,count=0;const fail=(error:Error)=>{zip.close();reject(error);};zip.once('error',fail);zip.once('end',()=>resolve(result));zip.on('entry',(entry:yauzl.Entry)=>{
 const directory=/^(images|audio)\/$/.test(entry.fileName),valid=entry.fileName==='manifest.json'||schema.assetPath(entry.fileName)||directory;
 if(!valid||result.has(entry.fileName)||++count>4003||(entry.generalPurposeBitFlag&1)||((entry.externalFileAttributes>>>16)&0o170000)===0o120000||entry.uncompressedSize>(entry.fileName==='manifest.json'?8*1024*1024:30*1024*1024)||(size+=entry.uncompressedSize)>2*MAX_PACKAGE){fail(new HttpError(400,'مسیر، تعداد یا حجم داخلی ZIP معتبر نیست.'));return;}
 if(!directory)result.set(entry.fileName,entry);zip.readEntry();});zip.readEntry();});}
async function stream(zip:yauzl.ZipFile,entry:yauzl.Entry){return new Promise<NodeJS.ReadableStream>((resolve,reject)=>zip.openReadStream(entry,(error,s)=>error||!s?reject(new HttpError(400,'خواندن فایل داخلی ZIP انجام نشد.')):resolve(s)));}
async function readEntry(zip:yauzl.ZipFile,entry:yauzl.Entry,max:number){const chunks:Buffer[]=[];let size=0;for await(const raw of await stream(zip,entry) as any){const chunk=Buffer.from(raw);size+=chunk.length;if(size>max)throw new HttpError(400,'فهرست بسته بیش از حد بزرگ است.');chunks.push(chunk);}return Buffer.concat(chunks);}
export async function inspectPackage(file:string,directory:string):Promise<PackageManifest>{
 const zip=await zipFile(file),staged=path.join(directory,'verified');await fs.mkdir(staged,{recursive:true,mode:0o700});const created:string[]=[];
 try{const list=await entries(zip),entry=list.get('manifest.json');if(!entry)throw new HttpError(400,'فهرست manifest.json در بسته نیست.');let manifest:PackageManifest;
  try{manifest=schema.validatePackage(JSON.parse((await readEntry(zip,entry,8*1024*1024)).toString('utf8')));}catch(error){throw new HttpError(400,error instanceof Error?error.message:'فهرست بسته معتبر نیست.');}
  if(list.size!==manifest.assets.length+1)throw new HttpError(400,'ZIP دارای فایل اضافه یا تکراری است.');
  const verified:PackageAsset[]=[];for(const asset of manifest.assets){const item=list.get(asset.path);if(!item||item.uncompressedSize!==asset.size)throw new HttpError(400,'فایلِ یکی از صفحه‌ها ناقص است.');const id=crypto.randomUUID(),extension=path.extname(asset.path).toLowerCase(),filename=id+extension,destination=path.join(staged,filename),hash=crypto.createHash('sha256');let size=0;
   const inspect=new Transform({transform(chunk,encoding,done){size+=chunk.length;if(size>asset.size){done(new HttpError(400,'حجم واقعی فایل با فهرست بسته برابر نیست.'));return;}hash.update(chunk);done(null,chunk);}});
   created.push(destination);await pipeline(await stream(zip,item) as any,inspect,sync.createWriteStream(destination,{flags:'wx',mode:0o600}));if(size!==asset.size||hash.digest('hex')!==asset.sha256)throw new HttpError(400,'امضای فایل با فهرست بسته برابر نیست؛ ZIP را دوباره بساز.');
   const header=Buffer.alloc(32),handle=await fs.open(destination,'r');try{await handle.read(header,0,32,0);}finally{await handle.close();}const image=asset.path.startsWith('images/'),detected=detectMedia(header,image?'cover':'audio');if(image){const info=await sharp(destination,{limitInputPixels:40_000_000}).metadata();if(!info.width||!info.height||info.width>16000||info.height>16000)throw new HttpError(400,'ابعاد تصویر معتبر نیست.');}
   const extMatches=extension==='.'+detected.extension||extension==='.jpeg'&&detected.extension==='jpg';if(!extMatches)throw new HttpError(400,'پسوند و محتوای یکی از فایل‌های بسته متفاوت‌اند.');
   verified.push({...asset,id,filename,mimeType:detected.mimeType,kind:image?'page-image':'audio'});
  }return {...manifest,assets:verified};
 }catch(error){for(const file of created)await fs.unlink(file).catch(()=>{});if(error instanceof HttpError)throw error;throw new HttpError(400,'خواندن بسته کامل نشد؛ فایل ZIP و تصویرها را بررسی کن.');}finally{zip.close();}
}
export async function assemblePackage(id:string,size:number){const directory=packageDirectory(id),file=path.join(directory,'book.zip');await fs.unlink(file).catch(()=>{});const output=await fs.open(file,'wx',0o600);try{for(let i=0;i<Math.ceil(size/PACKAGE_CHUNK);i++){const part=path.join(directory,`chunk-${i}`);for await(const chunk of sync.createReadStream(part))await output.writeFile(chunk);}}finally{await output.close();}return file;}
