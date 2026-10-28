import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { pathToFileURL } from 'url';
import os from 'os';
import * as yauzl from 'yauzl';
import { DOMParser } from '@xmldom/xmldom';
import mammoth from 'mammoth';
import {config} from '../config';

const exec=promisify(execFile);
export type ImportSource={id:string;filename:string;name:string;format:string;mimeType:string;language?:string};
export type ExtractedPage={number:number;heading:string;content:string;sourceAssetId:string;sourcePageNumber:number|null};
export const cleanText=(text:string)=>text.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000e-\u001f]/g,'').replace(/[\u200e\u200f\u202a-\u202e]/g,'').replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{4,}/g,'\n\n\n').trim();
export function needsOcr(text:string){
  const letters=text.match(/[ء-غف-يپچژکگی]/g)||[];
  const repeated=(text.match(/([ء-غف-يپچژکگی])\1{2,}/g)||[]).join('').length;
  return text.trim().length<20 || (letters.length>100&&repeated/letters.length>.012) || (text.match(/\ufffd/g)||[]).length>5;
}
export function paginateText(text:string,target=2400){
  const pages:string[]=[];let current='';
  for(const paragraph of cleanText(text).split(/\n\s*\n/)){
    for(const part of paragraph.length>target?paragraph.match(new RegExp(`[\\s\\S]{1,${target}}(?:\\s|$)|[\\s\\S]{1,${target}}`,'g'))||[]:[paragraph]){
      if(current&&current.length+part.length>target){pages.push(current.trim());current='';}
      current+=(current?'\n\n':'')+part;
    }
  }
  if(current.trim())pages.push(current.trim());return pages;
}
export async function ocrAvailable(){
  try{const langs=await exec(process.env.BONBOOK_TESSERACT||'tesseract',[...await tessdataArgs(),'--list-langs'],{timeout:5000,maxBuffer:10000});return /\bfas\b/.test(langs.stdout);}catch{return false;}
}
async function tessdataArgs(){const directory=process.env.BONBOOK_TESSDATA_DIR||path.resolve(config.mediaDirectory,'../ocr-models');try{await fs.access(path.join(directory,'fas.traineddata'));return ['--tessdata-dir',directory];}catch{return [];}}
async function recognize(image:string,language='fas'){
  try{const result=await exec(process.env.BONBOOK_TESSERACT||'tesseract',[image,'stdout',...await tessdataArgs(),'-l',language,'--oem','1','--psm','3'],{timeout:90_000,maxBuffer:1024*1024,env:{...process.env,OMP_THREAD_LIMIT:'1'}});return cleanText(result.stdout);}
  catch(error:any){if(error.code==='ENOENT')throw new Error('ابزار OCR فارسی روی سرور آماده نیست.');throw new Error('خواندن تصویر انجام نشد؛ کیفیت تصویر یا فایل را بررسی کنید.');}
}
async function zipEntries(file:string){
  return new Promise<Map<string,Buffer>>((resolve,reject)=>{
    yauzl.open(file,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
      if(error||!zip){reject(new Error('ساختار فایل فشرده معتبر نیست.'));return;}
      const result=new Map<string,Buffer>();let size=0,count=0,ended=false;
      const fail=(e:Error)=>{if(ended)return;ended=true;zip.close();reject(e);};zip.on('error',fail);zip.on('end',()=>{if(!ended){ended=true;resolve(result);}});
      zip.on('entry',(entry:yauzl.Entry)=>{
        if(++count>3000||entry.uncompressedSize>20*1024*1024||size+entry.uncompressedSize>80*1024*1024||entry.fileName.includes('..')||entry.fileName.startsWith('/')||entry.fileName.includes('\\')){fail(new Error('فایل فشرده بیش از حد بزرگ یا دارای مسیر نامعتبر است.'));return;}
        size+=entry.uncompressedSize;if(entry.fileName.endsWith('/')){zip.readEntry();return;}
        zip.openReadStream(entry,(streamError,stream)=>{
          if(streamError||!stream){fail(new Error('فایل فشرده قابل خواندن نیست.'));return;}
          const chunks:Buffer[]=[];let received=0;stream.on('error',fail);stream.on('data',(chunk:Buffer)=>{received+=chunk.length;if(received>20*1024*1024){stream.destroy();fail(new Error('بخش داخلی فایل بیش از حد بزرگ است.'));}else chunks.push(chunk);});stream.on('end',()=>{if(!ended){result.set(entry.fileName,Buffer.concat(chunks));zip.readEntry();}});
        });
      });zip.readEntry();
    });
  });
}
function xmlDocument(data:Buffer){const text=data.toString('utf8');if(/<!ENTITY/i.test(text))throw new Error('تعریف موجودیت خارجی در سند مجاز نیست.');return new DOMParser().parseFromString(text.replace(/<!DOCTYPE[^>]*>/gi,''),'text/xml');}
function xmlText(node:any):string{
  if(node.nodeType===3||node.nodeType===4)return node.nodeValue||'';
  if(['script','style','binary','svg'].includes((node.localName||'').toLowerCase()))return '';
  if(node.localName==='s')return ' '.repeat(Math.min(1000,Number(node.getAttribute('text:c'))||1));
  if(node.localName==='tab')return '\t';if(node.localName==='line-break')return '\n';
  const blocks=['p','h1','h2','h3','h4','div','section','chapter','li','tr','br'];let text='';for(let child=node.firstChild;child;child=child.nextSibling)text+=xmlText(child);
  return text+(blocks.includes(node.localName)?'\n\n':'');
}
async function documentText(file:string,format:string){
  if(format==='txt'||format==='md'){
    const buffer=await fs.readFile(file);if(buffer[0]===255&&buffer[1]===254)return buffer.subarray(2).toString('utf16le');
    try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{return new TextDecoder('windows-1256').decode(buffer);}
  }
  const entries=await zipEntries(file);
  if(format==='docx'){
    if(!entries.has('word/document.xml'))throw new Error('این فایل Word معتبر نیست.');
    const result=await mammoth.extractRawText({buffer:await fs.readFile(file)});return result.value;
  }
  if(format==='odt'){const content=entries.get('content.xml');if(!content)throw new Error('این فایل ODT معتبر نیست.');return xmlText(xmlDocument(content));}
  const container=entries.get('META-INF/container.xml');if(!container)throw new Error('این فایل EPUB معتبر نیست.');
  const elements=(doc:any,name:string)=>Array.from(doc.getElementsByTagName('*') as any[]).filter((node:any)=>node.localName===name) as any[];
  const root=elements(xmlDocument(container),'rootfile')[0]?.getAttribute('full-path')||'',packageXml=entries.get(root);
  if(!packageXml)throw new Error('فهرست کتاب EPUB پیدا نشد.');const doc=xmlDocument(packageXml),manifest=new Map<string,string>();
  for(const item of elements(doc,'item'))manifest.set(item.getAttribute('id')||'',item.getAttribute('href')||'');
  let result='';for(const item of elements(doc,'itemref')){
    const href=manifest.get(item.getAttribute('idref')||'');if(!href)continue;const name=path.posix.normalize(path.posix.join(path.posix.dirname(root),decodeURIComponent(href.split('#')[0])));
    if(name.startsWith('../'))throw new Error('مسیر EPUB معتبر نیست.');const data=entries.get(name);if(data)result+=xmlText(xmlDocument(data))+'\n\n';
  }return result;
}
export async function extractDocument(source:ImportSource,directory:string,mode:string,onTotal:(total:number,warning:string)=>Promise<void>,onPage:(page:ExtractedPage)=>Promise<void>,isCanceled:()=>Promise<boolean>,skipPages=0){
  const file=path.join(directory,source.filename),heading=(text:string)=>text.split('\n').find(line=>line.trim().length>3)?.trim().slice(0,150)||'';
  if(['jpg','jpeg','png','webp','tif','tiff','bmp'].includes(source.format)){
    const content=await recognize(file,source.language?.startsWith('en')?'eng':'fas');await onPage({number:1,heading:heading(content),content,sourceAssetId:source.id,sourcePageNumber:null});return;
  }
  if(source.format!=='pdf'){
    const pages=paginateText(await documentText(file,source.format));if(!pages.length)throw new Error('متن قابل خواندنی در فایل نبود. برای سند تصویری از PDF یا عکس و OCR استفاده کنید.');
    if(pages.length>2000)throw new Error('تعداد صفحه‌های فایل از ۲۰۰۰ بیشتر است. فایل را به چند بخش تقسیم کنید.');
    await onTotal(pages.length,'صفحه‌بندی این قالب بر اساس متن است و ممکن است با صفحه‌بندی نرم‌افزار Word فرق داشته باشد.');
    for(let i=skipPages;i<pages.length;i++){if(await isCanceled())return;await onPage({number:i+1,heading:heading(pages[i]),content:pages[i],sourceAssetId:source.id,sourcePageNumber:null});}return;
  }
  const dynamicImport=new Function('module','return import(module)') as (module:string)=>Promise<any>;
  const {getDocument}=await dynamicImport(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
  const task=getDocument({data:new Uint8Array(await fs.readFile(file)),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,verbosity:0});
  let temp='';
  try{
    const pdf=await task.promise;if(pdf.numPages>2000)throw new Error('تعداد صفحه‌های فایل از ۲۰۰۰ بیشتر است. فایل را به چند بخش تقسیم کنید.');
    const readPage=async(number:number)=>{
      const page=await pdf.getPage(number),{items}=await page.getTextContent();
      const lines=new Map<number,{str:string;x:number;dir:string}[]>();
      for(const item of items){if(typeof item.str!=='string'||!item.str.trim())continue;const y=Math.round(item.transform[5]*2)/2;const row=lines.get(y)||[];row.push({str:item.str,x:item.transform[4],dir:item.dir});lines.set(y,row);}
      const text=cleanText([...lines].sort(([a],[b])=>b-a).map(([,row])=>{const rtl=row.filter(item=>item.dir==='rtl').length>row.length/3;return row.sort((a,b)=>rtl?b.x-a.x:a.x-b.x).map(item=>item.str).join(' ');}).join('\n'));page.cleanup();return text;
    };
    const sampleNumbers=[...new Set([1,2,5,11,20].filter(n=>n<=pdf.numPages))],samples=[];
    for(const n of sampleNumbers)samples.push(await readPage(n).catch(()=>''));
    const available=await ocrAvailable(),bad=samples.some(text=>text.length>400&&needsOcr(text)),empty=samples.every(text=>text.trim().length<20);
    const allOcr=mode==='ocr'||(mode==='auto'&&(bad||empty));
    if(allOcr&&!available)throw new Error('این فایل به OCR نیاز دارد ولی ابزار فارسی روی سرور آماده نیست.');
    await onTotal(pdf.numPages,allOcr?'متن با تشخیص تصویر استخراج می‌شود؛ قبل از انتشار آن را بازبینی کنید.':bad?'لایهٔ متن این فایل نامنظم است. برای نتیجهٔ بهتر حالت OCR را انتخاب کنید.':'');
    temp=await fs.mkdtemp(path.join(os.tmpdir(),'bonbook-ocr-'));
    for(let number=skipPages+1;number<=pdf.numPages;number++){
      if(await isCanceled())return;let content=await readPage(number).catch(()=> '');
      if(allOcr||(mode==='auto'&&available&&needsOcr(content))){
        const prefix=path.join(temp,'page');
        try{await exec(process.env.BONBOOK_PDFTOPPM||'pdftoppm',['-f',String(number),'-l',String(number),'-scale-to','2200','-singlefile','-gray','-png',file,prefix],{timeout:60_000,maxBuffer:100000,env:{...process.env,OMP_THREAD_LIMIT:'1'}});}catch{throw new Error('تبدیل صفحهٔ PDF به تصویر انجام نشد.');}
        const arabic=(content.match(/[ء-غف-يپچژکگی]/g)||[]).length,latin=(content.match(/[A-Za-z]/g)||[]).length;
        const language=arabic+latin<20?(source.language?.startsWith('en')?'eng':'fas'):arabic/(arabic+latin)>.65?'fas':arabic/(arabic+latin)<.15?'eng':'fas+eng';
        content=await recognize(prefix+'.png',language);await fs.unlink(prefix+'.png').catch(()=>{});
      }
      if(content.length>40_000)throw new Error(`متن صفحهٔ ${number} بیش از حد بزرگ است.`);
      await onPage({number,heading:heading(content),content,sourceAssetId:source.id,sourcePageNumber:number});
    }
  }finally{await task.destroy();if(temp){await fs.unlink(path.join(temp,'page.png')).catch(()=>{});await fs.rmdir(temp).catch(()=>{});}}
}
