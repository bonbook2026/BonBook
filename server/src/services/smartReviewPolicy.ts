import {validateAudioCues} from './audioCues';
type Cue={offset:number;time:number};
export interface ReviewEvidence{offset:number;matched:number;total:number;leadingMissed:number;probability:number}
export interface ReviewRecognition{cues:Cue[];evidence?:ReviewEvidence[];coverage:number;spokenCoverage:number;lineCoverage:number;safe:boolean;duration:number}
export function planSmartReview(content:string,audioAssetId:string,beforeCues:string,beforeMode:string,result:ReviewRecognition,lines:{start:number;end:number}[]){
 let existing:Cue[];try{existing=JSON.parse(beforeCues);validateAudioCues(existing,content,audioAssetId);}catch{return {status:'UNRESOLVED',cues:beforeCues,mode:beforeMode,added:0,preserved:0,unresolved:lines.map(line=>line.start),message:'قالب زمان‌بندی قبلی معتبر نیست؛ برای جلوگیری از تغییر ناخواسته، دست‌نخورده ماند.'};}
 const base={cues:beforeCues,mode:beforeMode,added:0,preserved:existing.length,unresolved:[] as number[]};
 if(existing.length&&['MANUAL','AUTO'].includes(beforeMode))return {...base,status:'PRESERVED',message:'زمان‌بندی کامل قبلی بدون تغییر حفظ شد.'};
 const strongGlobal=Number.isFinite(result.coverage)&&result.coverage>=.78&&Number.isFinite(result.spokenCoverage)&&result.spokenCoverage>=.65&&Number.isFinite(result.duration)&&result.duration>0;
 const evidence=new Map((result.evidence||[]).map(row=>[row.offset,row]));
 const trusted=strongGlobal?result.cues.filter(cue=>{
  const row=evidence.get(cue.offset);if(!row||!Number.isFinite(cue.time)||cue.time<0||cue.time>result.duration)return false;
  return row.total>0&&row.matched/row.total>=.65&&row.leadingMissed<=2&&row.leadingMissed/row.total<=.3&&row.probability>=.35&&(row.total>=3&&row.matched>=2||row.leadingMissed===0&&row.matched===row.total&&row.probability>=.7);
 }):[];
 const merged=[...existing],accepted=new Set<number>();let added=0;
 for(const cue of trusted){
  const at=merged.findIndex(row=>row.offset>=cue.offset),next=at<0?undefined:merged[at],previous=at<0?merged[merged.length-1]:merged[at-1];
  if(next?.offset===cue.offset){if(Math.abs(next.time-cue.time)<=1)accepted.add(cue.offset);continue;}
  if(previous&&previous.time>=cue.time||next&&next.time<=cue.time)continue;
  merged.splice(at<0?merged.length:at,0,cue);accepted.add(cue.offset);added++;
 }
 const unresolved=lines.filter(line=>!accepted.has(line.start)).map(line=>line.start),full=Boolean(result.safe&&unresolved.length===0&&trusted.length);
 const useful=full||strongGlobal&&accepted.size>=Math.min(3,lines.length)&&accepted.size/Math.max(1,lines.length)>=.7;
 if(!useful||!added&&!full)return {...base,status:existing.length&&!unresolved.length?'PRESERVED':'UNRESOLVED',unresolved,message:'برای تغییر مطمئن شواهد کافی پیدا نشد؛ زمان‌بندی قبلی حفظ شد.'};
 const serialized=validateAudioCues(merged,content,audioAssetId);
 return {status:full?'FIXED':'PARTIAL',cues:serialized,mode:full?'AUTO':'PARTIAL',added,preserved:existing.length,unresolved,message:full?'تطبیق مطمئن اصلاح شد؛ زمان‌های قبلی حفظ و بخش‌های خالی تکمیل شدند.':'بخش‌های مطمئن تکمیل شدند؛ زمان‌های قبلی حفظ شدند و برای بخش نامطمئن زمان حدسی ساخته نشد.'};
}
