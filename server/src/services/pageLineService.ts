import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import sharp from 'sharp';
import {execFile,spawn} from 'child_process';
import {promisify} from 'util';
import {pathToFileURL} from 'url';
import {config} from '../config';
import {pdfPageImage} from './pageImageService';
const exec=promisify(execFile);
export interface PageLine{start:number;end:number;x:number;y:number;width:number;height:number;time?:number}
export interface PageWord{start:number;end:number;rects:{x:number;y:number;width:number;height:number}[];time?:number;endTime?:number;lineStart?:number}
export interface PageLineResult{status:'ready'|'processing'|'unavailable';lines:PageLine[];coverage:number;words?:PageWord[];wordCount?:number;timedWordCount?:number;source?:'pdf'|'ocr';message?:string;refining?:boolean}
interface Row{x:number;y:number;width:number;height:number;text:string;words?:{x:number;y:number;width:number;height:number;text:string;confidence:number}[]}
interface MatchResult{lines:PageLine[];coverage:number;words:PageWord[];wordCount:number;timedWordCount:number}
interface Source{id:string;filename:string;mimeType:string}
export interface LinePage{content:string;visualMode:string;audioAssetId:string|null;audioCues:string;audioCueMode:string;sourcePageNumber:number|null;image:Source|null;source:Source|null;audio?:Source|null;language?:string;alignments:{contentHash:string;audioAssetId:string;cues:string;words:string}[]}
const pending=new Map<string,Promise<void>>(),failures=new Map<string,number>();let tail:Promise<unknown>=Promise.resolve(),refineTail:Promise<unknown>=Promise.resolve();const refining=new Map<string,Promise<void>>();
const python=()=>process.env.BONBOOK_PAGE_PYTHON||(process.platform==='win32'?'python':'python3');
async function match(content:string,rows:Row[],words?:unknown,refined?:unknown):Promise<MatchResult>{
 return new Promise((resolve,reject)=>{
  const child=spawn(python(),[path.resolve(__dirname,'../../speech/page_lines.py')],{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let output='',error='';
  const timer=setTimeout(()=>{child.kill();reject(new Error('Line matching timed out'));},20000);
  child.on('error',e=>{clearTimeout(timer);reject(e);});child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1500000){child.kill();reject(new Error('Line map too large'));}});child.stderr.on('data',chunk=>{if(error.length<2000)error+=chunk;});
  child.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw new Error('Line matching unavailable');resolve(JSON.parse(output));}catch(e){reject(e);}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({content,rows,words,refined}));
 });
}
async function pdfRows(source:Source,number:number):Promise<Row[]>{
 const load=new Function('module','return import(module)') as (name:string)=>Promise<any>;
 const {getDocument,Util}=await load(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
 const task=getDocument({data:new Uint8Array(await fs.readFile(path.join(config.mediaDirectory,source.filename))),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,verbosity:0});
 try{const pdf=await task.promise;if(number>pdf.numPages)return [];const page=await pdf.getPage(number),viewport=page.getViewport({scale:1}),content=await page.getTextContent(),rows:{y:number;height:number;items:any[]}[]=[];
  for(const item of content.items){if(typeof item.str!=='string'||!item.str.trim()||!item.width||!item.height)continue;const t=Util.transform(viewport.transform,item.transform),h=Math.hypot(t[2],t[3]),style=content.styles[item.fontName],y=t[5]-h*(style?.ascent||.85),x=t[4],w=item.width;
   if(![x,y,w,h].every(Number.isFinite)||Math.abs(t[1])>.1)continue;let row=rows.find(row=>Math.abs(row.y-y)<Math.min(h,row.height)*.4);if(!row){row={y,height:h,items:[]};rows.push(row);}row.items.push({x,y,w,h,text:item.str,rtl:item.dir==='rtl'});
  }
  return rows.sort((a,b)=>a.y-b.y).slice(0,250).map(row=>{const rtl=row.items.filter(i=>i.rtl).length>row.items.length/3,items=row.items.sort((a,b)=>rtl?b.x-a.x:a.x-b.x),x=Math.min(...items.map(i=>i.x)),y=Math.min(...items.map(i=>i.y)),right=Math.max(...items.map(i=>i.x+i.w)),bottom=Math.max(...items.map(i=>i.y+i.h));return {text:items.map(i=>i.text).join(' '),x:x/viewport.width,y:y/viewport.height,width:(right-x)/viewport.width,height:(bottom-y)/viewport.height,words:items.map(item=>({text:item.text,x:item.x/viewport.width,y:item.y/viewport.height,width:item.w/viewport.width,height:item.h/viewport.height,confidence:100}))};});
 }finally{await task.destroy();}
}
export function tsvRows(tsv:string,width:number,height:number):Row[]{
 const rows=new Map<string,{text:string[];left:number;top:number;right:number;bottom:number;words:NonNullable<Row['words']>}>();
 for(const line of tsv.split(/\r?\n/).slice(1)){const fields=line.split('\t');if(fields[0]!=='5'||fields.length<12||Number(fields[10])<25||!fields[11].trim())continue;const [left,top,w,h]=fields.slice(6,10).map(Number);if(![left,top,w,h].every(Number.isFinite)||w<=0||h<=0)continue;const key=fields.slice(1,5).join('-'),row=rows.get(key)||{text:[],left,top,right:left+w,bottom:top+h,words:[]};row.words.push({text:fields.slice(11).join('\t'),x:left/width,y:top/height,width:w/width,height:h/height,confidence:Number(fields[10])});row.text.push(fields.slice(11).join('\t'));row.left=Math.min(row.left,left);row.top=Math.min(row.top,top);row.right=Math.max(row.right,left+w);row.bottom=Math.max(row.bottom,top+h);rows.set(key,row);}
 return [...rows.values()].slice(0,250).map(row=>({text:row.text.join(' '),x:row.left/width,y:row.top/height,width:(row.right-row.left)/width,height:(row.bottom-row.top)/height,words:row.words}));
}
async function ocrRows(source:Source,number:number|null){
 const raw=source.mimeType==='application/pdf'&&number?await pdfPageImage(source.id,source.filename,number):path.join(config.mediaDirectory,source.filename),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'bonbook-lines-')),image=path.join(temporary,'page.png');
 try{const info=await sharp(raw,{limitInputPixels:40000000}).rotate().resize({width:2000,height:2600,fit:'inside',withoutEnlargement:true}).png().toFile(image),model=process.env.BONBOOK_TESSDATA_DIR||path.resolve(config.mediaDirectory,'../ocr-models');let args:string[]=[];try{await fs.access(path.join(model,'fas.traineddata'));args=['--tessdata-dir',model];}catch{}
  const result=await exec(process.env.BONBOOK_TESSERACT||'tesseract',[image,'stdout',...args,'-l','fas+eng','--oem','1','--psm','3','-c','tessedit_create_tsv=1'],{timeout:90000,maxBuffer:2*1024*1024,windowsHide:true,env:{...process.env,OMP_THREAD_LIMIT:'1'}});return tsvRows(result.stdout,info.width,info.height);
 }finally{await fs.unlink(image).catch(()=>{});await fs.rmdir(temporary).catch(()=>{});}
}
export async function pageLineMap(page:LinePage):Promise<PageLineResult>{
 const source=page.image||page.source,number=page.image?null:page.sourcePageNumber;
 if(!source||!page.content.trim()||['TEXT','IMAGE'].includes(page.visualMode)||!(source.mimeType.startsWith('image/')||source.mimeType==='application/pdf'&&number))return {status:'unavailable',lines:[],coverage:0,message:'برای این صفحه تصویر و متنِ قابل تطبیق ثبت نشده است.'};
 const contentHash=crypto.createHash('sha256').update(page.content).digest('hex'),alignment=page.alignments.find(job=>job.contentHash===contentHash&&job.audioAssetId===page.audioAssetId&&job.cues===page.audioCues&&page.audioCueMode==='AUTO');
 const key=crypto.createHash('sha256').update(JSON.stringify(['words-v5-aligned',source.id,number,page.audioAssetId,page.content,page.audioCues,alignment?.words||''])).digest('hex'),directory=path.resolve(config.mediaDirectory,'../page-line-maps'),file=path.join(directory,key+'.json');
 try{const cached=JSON.parse(await fs.readFile(file,'utf8'));if((cached.status==='ready'&&(!cached.refining||refining.has(key)))||cached.status!=='ready'&&Date.now()-(await fs.stat(file)).mtimeMs<60000)return cached;}catch{}
 if((failures.get(key)||0)>Date.now())return {status:'unavailable',lines:[],coverage:0,message:'جای خط‌های این صفحه فعلاً آماده نشد؛ زیرنویس همراه صدا در دسترس است.'};
 if(!pending.has(key)&&pending.size<6){
  const job=tail.catch(()=>{}).then(async()=>{let result:MatchResult={lines:[],coverage:0,words:[],wordCount:0,timedWordCount:0},kind:'pdf'|'ocr'='pdf';let rows:Row[]=[];let words:unknown;try{words=alignment?JSON.parse(alignment.words):undefined;}catch{}
   if(source.mimeType==='application/pdf'&&number&&!page.image){try{rows=await pdfRows(source,number);result=await match(page.content,rows,words);}catch{}}
   if(result.coverage<.78||result.words.length<result.wordCount*.9){try{const ocr=await ocrRows(source,number),recognized=await match(page.content,ocr,words);if(recognized.timedWordCount>result.timedWordCount||recognized.timedWordCount===result.timedWordCount&&(recognized.words.length>result.words.length||recognized.coverage>result.coverage)){result=recognized;rows=ocr;kind='ocr';}}catch{}}
   const valid=result.coverage>=.5&&result.lines.length>0,value:PageLineResult={...result,lines:valid?result.lines:[],words:valid?result.words:[],status:valid?'ready':'unavailable',source:kind,...(!valid?{message:'تطبیق خط‌های تصویر با متن این صفحه مطمئن نیست؛ زیرنویس همراه صدا را دنبال کن.'}:{})};
   await fs.mkdir(directory,{recursive:true,mode:0o700});
   const save=async(data:PageLineResult)=>{const staged=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(staged,JSON.stringify(data),{mode:0o600});await fs.rename(staged,file);}finally{await fs.unlink(staged).catch(()=>{});}};
   const engine=process.env.BONBOOK_SPEECH_PYTHON||'/srv/bonbook-preproduction/shared/speech-venv/bin/python',model=process.env.BONBOOK_SPEECH_MODEL||'/srv/bonbook-preproduction/shared/speech-models/small';
   let canRefine=Boolean(valid&&alignment&&page.audio&&refining.size<6);if(canRefine){try{await Promise.all([fs.access(engine),fs.access(path.join(model,'model.bin'))]);}catch{canRefine=false;}}
   if(canRefine){
    let release:()=>void=()=>{};const saved=new Promise<void>(resolve=>{release=resolve;});const work=refineTail.catch(()=>{}).then(()=>saved).then(async()=>{try{const forced=await forceWords(engine,model,page);const improved=await match(page.content,rows,words,forced);await save(improved.timedWordCount>result.timedWordCount?{...value,...improved,refining:false}:{...value,refining:false});}catch{await save({...value,refining:false});}}).catch(()=>{}).finally(()=>refining.delete(key));
    // Register before exposing the intermediate map; active readers can use it immediately.
    refining.set(key,work);refineTail=work;try{await save({...value,refining:true});}finally{release();}
   }else await save(value);
  }).catch(()=>{if(failures.size>100)failures.clear();failures.set(key,Date.now()+60000);}).finally(()=>pending.delete(key));pending.set(key,job);tail=job;
 }
 return {status:'processing',lines:[],coverage:0};
}

async function forceWords(engine:string,model:string,page:LinePage):Promise<unknown>{
 return new Promise((resolve,reject)=>{const child=spawn(engine,[path.resolve(__dirname,'../../speech/force_page_words.py')],{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,HF_HUB_OFFLINE:'1',OMP_NUM_THREADS:'1',PYTHONIOENCODING:'utf-8'}});let output='';const timer=setTimeout(()=>{child.kill();reject(new Error('Word alignment timed out'));},180000);child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1500000){child.kill();reject(new Error('Word alignment too large'));}});child.stderr.on('data',()=>{});child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw new Error('Word alignment unavailable');resolve(JSON.parse(output).words);}catch(error){reject(error);}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({text:page.content,cues:JSON.parse(page.audioCues),audio:path.join(config.mediaDirectory,page.audio!.filename),model,language:page.language?.split('-')[0]||'fa'}));});
}
