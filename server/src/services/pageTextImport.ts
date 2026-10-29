import crypto from 'crypto';
import path from 'path';
import {cleanText} from './documentExtraction';
import {normalizePersian} from './searchService';
import {validateAudioCues} from './audioCues';
import {HttpError} from '../lib/httpError';

export type TextFile={name:string;text:string};
export type NumberedText={number:number;content:string;source:string};
type Cue={time:number;offset:number};
type Token={value:string;start:number;end:number};
export type TextChange={sourceNumber:number;number:number;source:string;pageId:number|null;heading:string;status:'READY'|'REVIEW'|'EMPTY'|'MISSING'|'UNCHANGED';reason:string;similarity:number;cueCount:number;exactCues:number;beforeContent:string;content:string;beforeCues:string;cues:string;beforeMode:string;mode:string;beforeHash:string;afterHash?:string;applied?:boolean};
export const westernDigits=(value:string)=>value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const pageNumber=(raw:string)=>{const value=Number(westernDigits(raw));if(!Number.isSafeInteger(value)||value<1||value>100000)throw new HttpError(400,'شمارهٔ صفحه باید بین ۱ و ۱۰۰٬۰۰۰ باشد.');return value;};

// Markers occupy their own line. Numbers occurring in book prose are never delimiters.
function marker(line:string){
 const value=westernDigits(line).replace(/[\u200e\u200f\u202a-\u202e]/g,'').trim();
 const found=value.match(/^(?:[=\-#*_]{2,}\s*)?(?:page|صفحه(?:ٔ|‌ی|\s+ی)?|برگ)\s*[:：#\-]?\s*(\d{1,6})\s*(?:[=\-#*_]{2,})?\s*$/iu);
 return found?pageNumber(found[1]):null;
}
export function decodePageText(buffer:Buffer){
 if(buffer[0]===255&&buffer[1]===254)return buffer.subarray(2).toString('utf16le');
 if(buffer[0]===254&&buffer[1]===255){const copy=Buffer.from(buffer.subarray(2));if(copy.length%2)throw new HttpError(400,'کدگذاری فایل متنی ناقص است.');copy.swap16();return copy.toString('utf16le');}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{return new TextDecoder('windows-1256').decode(buffer);}
}
export function parseNumberedTexts(files:TextFile[]):NumberedText[]{
 if(!files.length||files.length>2000)throw new HttpError(400,'یک فایل کامل یا حداکثر ۲۰۰۰ فایل متنی صفحه انتخاب کنید.');
 const result:NumberedText[]=[],seen=new Map<number,NumberedText>();
 const add=(number:number,content:string,source:string)=>{
  const value=cleanText(content);if(value.length>40000)throw new HttpError(400,`متن صفحهٔ ${number} بیش از ۴۰٬۰۰۰ حرف است.`);
  if(seen.has(number))throw new HttpError(400,`شمارهٔ صفحهٔ ${number} تکراری است؛ فایل کامل و فایل‌های همان صفحه را هم‌زمان انتخاب نکنید.`);
  const item={number,content:value,source};seen.set(number,item);result.push(item);
  if(result.length>2000)throw new HttpError(400,'در هر نوبت حداکثر ۲۰۰۰ صفحه وارد کنید.');
 };
 for(const file of files){
  const text=file.text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(text.includes('\u0000'))throw new HttpError(400,'فایل متنی معتبر نیست. از TXT با کدگذاری UTF-8 استفاده کنید.');
  const lines=text.split('\n'),marks=lines.flatMap((line,index)=>{const number=marker(line);return number===null?[]:[{index,number}];});
  if(marks.length){
   if(cleanText(lines.slice(0,marks[0].index).join('\n')))throw new HttpError(400,`در ${file.name} متنِ بدون شماره قبل از اولین جداکننده وجود دارد. برای جلوگیری از حذف آن، شمارهٔ صفحه اضافه کنید.`);
   for(let i=0;i<marks.length;i++)add(marks[i].number,lines.slice(marks[i].index+1,marks[i+1]?.index??lines.length).join('\n'),file.name);
  }else{
   const stem=westernDigits(path.basename(file.name,path.extname(file.name)));
   const found=stem.match(/^(?:(?:page|صفحه|برگ)[\s_\-]*)?(\d{1,6})$/iu);
   if(!found)throw new HttpError(400,`شمارهٔ صفحه در ${file.name} پیدا نشد. نامی مثل page-0011.txt یا جداکنندهٔ «=== Page 11 ===» لازم است.`);
   add(pageNumber(found[1]),text,file.name);
  }
 }
 return result.sort((a,b)=>a.number-b.number);
}
function tokens(text:string):Token[]{
 return [...text.matchAll(/[\p{L}\p{N}\p{M}\u200c]+/gu)].map(match=>({value:normalizePersian(match[0]).replace(/[\s\u200c\u0640\u064b-\u065f\u0670]/g,''),start:match.index!,end:match.index!+match[0].length})).filter(t=>t.value);
}
function wordMatches(old:Token[],next:Token[]){
 // Bounded LCS: at most 8 MB, released after each page. Never allocate by upload size squared.
 if((old.length+1)*(next.length+1)>4_000_000)return [] as [number,number][];
 const width=next.length+1,table=new Uint16Array((old.length+1)*width);
 for(let i=old.length-1;i>=0;i--)for(let j=next.length-1;j>=0;j--)table[i*width+j]=old[i].value===next[j].value?table[(i+1)*width+j+1]+1:Math.max(table[(i+1)*width+j],table[i*width+j+1]);
 const matches:[number,number][]=[];let i=0,j=0;
 while(i<old.length&&j<next.length){if(old[i].value===next[j].value){matches.push([i++,j++]);}else if(table[(i+1)*width+j]>=table[i*width+j+1])i++;else j++;}
 return matches;
}
export function remapTextCues(oldContent:string,content:string,rawCues:string,audioId:string|null){
 let cues:Cue[];try{cues=JSON.parse(rawCues);validateAudioCues(cues,oldContent,audioId);}catch{throw new HttpError(409,'زمان‌بندی فعلی صفحه معتبر نیست؛ ابتدا آن صفحه را بازبینی کنید.');}
 const old=tokens(oldContent),next=tokens(content),matches=wordMatches(old,next),map=new Map(matches),similarity=old.length&&next.length?2*matches.length/(old.length+next.length):old.length===next.length?1:0;
 let exact=0,previous=-1;
 const mapped=cues.map((cue,index)=>{
  const at=old.findIndex(token=>token.end>cue.offset),matched=map.get(at);
  let offset:number;
  if(matched!==undefined){offset=next[matched].start;exact++;}
  else{
   const before=[...matches].reverse().find(([a])=>a<at),after=matches.find(([a])=>a>at);
   const left=before?{old:old[before[0]].end,next:next[before[1]].end}:{old:0,next:0},right=after?{old:old[after[0]].start,next:next[after[1]].start}:{old:oldContent.length,next:content.length};
   offset=Math.round(left.next+(right.next-left.next)*Math.max(0,Math.min(1,(cue.offset-left.old)/Math.max(1,right.old-left.old))));
   const word=next.find(t=>t.start>=offset);if(word&&word.start-offset<25)offset=word.start;
  }
  const lower=previous+1,upper=content.length-(cues.length-index);
  if(lower>upper)throw new HttpError(409,'متن جدید برای نگه‌داشتن همهٔ زمان‌های قبلی کوتاه است.');
  const bounded=Math.max(lower,Math.min(upper,offset));if(bounded!==offset&&matched!==undefined)exact--;previous=bounded;
  return {time:cue.time,offset:bounded};
 });
 return {cues:validateAudioCues(mapped,content,audioId),similarity,exact,total:cues.length};
}
// Include fields that must not be overwritten by a stale preview or undo.
export function textPageHash(page:any){return crypto.createHash('sha256').update(JSON.stringify([page.id,page.bookId,page.number,page.heading,page.content,page.keywords,page.audioAssetId,page.audioCues,page.audioCueMode,page.imageAssetId,page.sourceAssetId,page.sourcePageNumber,page.visualMode])).digest('hex');}
export function planTextChanges(parsed:NumberedText[],pages:any[],offset:number):TextChange[]{
 const byNumber=new Map(pages.map(page=>[page.number,page]));
 return parsed.map(source=>{
  const number=source.number+offset;if(number<1||number>100000)throw new HttpError(400,'اختلاف شماره باعث خروج از محدودهٔ صفحه‌های مجاز شده است.');
  const page=byNumber.get(number),item:TextChange={sourceNumber:source.number,number,source:source.source,pageId:page?.id??null,heading:page?.heading||'',status:'READY',reason:'شمارهٔ صفحه یکسان است؛ فقط متن و جای حروف زیرنویس به‌روز می‌شوند.',similarity:0,cueCount:0,exactCues:0,beforeContent:page?.content||'',content:source.content,beforeCues:page?.audioCues||'[]',cues:page?.audioCues||'[]',beforeMode:page?.audioCueMode||'NONE',mode:page?.audioCueMode||'NONE',beforeHash:page?textPageHash(page):''};
  if(!page){item.status='MISSING';item.reason='این شماره در کتاب وجود ندارد؛ هیچ صفحه‌ای ساخته یا جابه‌جا نمی‌شود.';return item;}
  if(!source.content.trim()){item.status='EMPTY';item.reason='متن ورودی خالی است؛ متن فعلی پاک نمی‌شود.';return item;}
  if(source.content===page.content){item.status='UNCHANGED';item.similarity=1;item.reason='متن از قبل یکسان است.';return item;}
  try{
   const mapped=remapTextCues(page.content,source.content,page.audioCues,page.audioAssetId);
   item.cues=mapped.cues;item.similarity=mapped.similarity;item.cueCount=mapped.total;item.exactCues=mapped.exact;
   if(mapped.total&&mapped.exact!==mapped.total){item.mode='PARTIAL';item.reason='زمان‌های صوت حفظ می‌شوند؛ بعضی جایگاه‌های متن تقریبی‌اند و بازبینی لازم دارند.';item.status='REVIEW';}
   if(page.content.trim()&&mapped.similarity<.45){item.status='REVIEW';item.reason='شباهت متن کم است؛ احتمال اختلاف صفحه یا تغییر زیاد متن وجود دارد.';}
   item.afterHash=textPageHash({...page,content:item.content,audioCues:item.cues,audioCueMode:item.mode});
  }catch(error){item.status='REVIEW';item.reason=error instanceof Error?error.message:'تطبیق زمان‌بندی نیاز به بررسی دارد.';}
  return item;
 });
}
export function textChangeSummary(item:TextChange){return {sourceNumber:item.sourceNumber,number:item.number,source:item.source,heading:item.heading,status:item.status,reason:item.reason,similarity:item.similarity,cueCount:item.cueCount,exactCues:item.exactCues,oldLength:item.beforeContent.length,newLength:item.content.length,canApply:Boolean(item.afterHash)&&['READY','REVIEW'].includes(item.status),applied:!!item.applied};}
