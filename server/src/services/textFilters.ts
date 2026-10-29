import crypto from 'crypto';
import {HttpError} from '../lib/httpError';
import {validateAudioCues} from './audioCues';

export const DEFAULT_TEXT_FILTERS=['<short pause>'];
export const textFilterKey=(bookId:number)=>`book-text-filters:${bookId}`;
export function validateTextFilters(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>50||value.some(v=>typeof v!=='string'||v.length>200||/[\r\n\u0000]/.test(v)))throw new HttpError(400,'حداکثر ۵۰ عبارت، هر عبارت تا ۲۰۰ حرف و در یک خط وارد کنید.');
 const result:string[]=[],seen=new Set<string>();
 for(const entry of value){const text=entry.trim();if(text&&!seen.has(text.toLowerCase())){seen.add(text.toLowerCase());result.push(text);}}
 return result;
}
export async function bookTextFilters(db:any,bookId:number):Promise<string[]>{
 const row=await db.siteSetting.findUnique({where:{key:textFilterKey(bookId)}});
 if(!row)return [...DEFAULT_TEXT_FILTERS];
 try{return validateTextFilters(JSON.parse(row.value));}catch{throw new HttpError(409,'فهرست فیلتر متن معتبر نیست؛ دوباره آن را ذخیره کنید.');}
}
export const textFilterSignature=(phrases:string[])=>crypto.createHash('sha256').update(JSON.stringify(phrases.map(p=>p.toLowerCase()).sort())).digest('hex');

export function filterNarrationText(text:string,phrases:string[]=DEFAULT_TEXT_FILTERS){
 const ranges:{start:number;end:number;position:number;replacement:string}[]=[];
 if(!phrases.length)return {content:text,removedCount:0,mapOffset:(offset:number)=>offset};
 // Every phrase is escaped: administrators enter literal text, never regex or HTML.
 const expression=new RegExp([...phrases].sort((a,b)=>b.length-a.length).map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'giu');
 let removedCount=0;
 for(const match of text.matchAll(expression)){
  removedCount++;let start=match.index!,end=start+match[0].length;
  while(start>0&&/[ \t]/.test(text[start-1]))start--;while(end<text.length&&/[ \t]/.test(text[end]))end++;
  const last=ranges[ranges.length-1];if(last&&start<=last.end)last.end=Math.max(last.end,end);else ranges.push({start,end,position:0,replacement:''});
 }
 if(!removedCount)return {content:text,removedCount:0,mapOffset:(offset:number)=>offset};
 let raw='',cursor=0;
 for(const range of ranges){raw+=text.slice(cursor,range.start);range.position=raw.length;range.replacement=range.start>0&&range.end<text.length&&!/[\r\n]/.test(text[range.start-1]+text[range.end])?' ':'';raw+=range.replacement;cursor=range.end;}
 raw+=text.slice(cursor);const leading=raw.length-raw.trimStart().length,content=raw.trim();
 const mapOffset=(offset:number)=>{
  let shift=0;
  for(const range of ranges){if(offset<range.start)break;if(offset<range.end)return Math.max(0,Math.min(content.length,range.position-leading));shift+=range.replacement.length-(range.end-range.start);}
  return Math.max(0,Math.min(content.length,offset+shift-leading));
 };
 return {content,removedCount,mapOffset};
}
export function filterTextAndCues(content:string,rawCues:string,audioId:string|null,phrases:string[]){
 const filtered=filterNarrationText(content,phrases),cues=JSON.parse(rawCues) as {time:number;offset:number}[];
 validateAudioCues(cues,content,audioId);
 if(!filtered.removedCount)return {...filtered,cues:rawCues,approximate:false};
 let previous=-1,approximate=false;
 const adjusted=cues.map((cue,index)=>{
  const target=filtered.mapOffset(cue.offset),lower=previous+1,upper=filtered.content.length-(cues.length-index);
  if(lower>upper)throw new HttpError(409,'پس از حذف عبارت‌ها، متن کافی برای حفظ همهٔ نقطه‌های صوتی وجود ندارد؛ این صفحه را بازبینی کنید.');
  const offset=Math.max(lower,Math.min(upper,target));if(offset!==target)approximate=true;previous=offset;return {time:cue.time,offset};
 });
 return {...filtered,cues:validateAudioCues(adjusted,filtered.content,audioId),approximate};
}
