import crypto from 'crypto';

export type SetupStepId='metadata'|'pages'|'cover'|'text'|'audio'|'alignment'|'contents'|'publish';
export type SetupState='done'|'todo'|'working'|'review'|'optional';
export interface SetupStep{id:SetupStepId;status:SetupState;required:boolean;completed:number;total:number;remaining:number;pageNumbers:number[];detail:string}
interface SetupPage{number:number;content:string;visualMode:string;audioAssetId:string|null;audioCues:string;audioCueMode:string;alignments?:{status:string;audioAssetId:string;contentHash:string}[]}
export interface SetupBook{title:string;author:string;category:string;status:string;coverAssetId:string|null;pages:SetupPage[];contents:{pageNumber:number}[];imports?:{status:string;totalPages:number;completedPages:number}[];audioBatches?:{status:string;items:{status:string}[]}[]}
const fa=(n:number)=>n.toLocaleString('fa-IR');
function timed(page:SetupPage){
 if(!page.audioAssetId||!page.content.trim()||page.audioCueMode==='PARTIAL')return false;
 try{const cues=JSON.parse(page.audioCues);if(!Array.isArray(cues)||!cues.length)return false;let time=-1,offset=-1;
  for(const cue of cues){if(typeof cue?.time!=='number'||!Number.isFinite(cue.time)||cue.time<0||cue.time>86400||cue.time<=time||!Number.isInteger(cue.offset)||cue.offset<0||cue.offset>=page.content.length||cue.offset<=offset)return false;time=cue.time;offset=cue.offset;}
  return true;
 }catch{return false;}
}
/** Derived from current persisted content, never from guide clicks or job history alone. */
export function buildBookSetupProgress(book:SetupBook){
 const pages=book.pages,nonImage=pages.filter(page=>page.visualMode!=='IMAGE'),textMissing=nonImage.filter(page=>!page.content.trim());
 const audioTarget=pages.filter(page=>page.visualMode!=='IMAGE'||page.audioAssetId),audioMissing=audioTarget.filter(page=>!page.audioAssetId);
 const narrated=nonImage.filter(page=>page.audioAssetId),unTimed=narrated.filter(page=>!timed(page)),pageNumbers=new Set(pages.map(page=>page.number));
 const contents=book.contents.filter(entry=>pageNumbers.has(entry.pageNumber)),invalidContents=book.contents.length-contents.length;
 const missingMetadata=[!book.title.trim()?'عنوان':'',!book.author.trim()?'نویسنده':'',!book.category.trim()?'دسته‌بندی':''].filter(Boolean);
 const imported=book.imports?.[0],batch=book.audioBatches?.[0];
 const waitingAudio=batch?.status==='UPLOADING'?batch.items.filter(item=>item.status==='WAITING'||item.status==='FAILED').length:0;
 const currentJobs=unTimed.map(page=>{const job=page.alignments?.[0];return job&&job.audioAssetId===page.audioAssetId&&job.contentHash===crypto.createHash('sha256').update(page.content).digest('hex')?job.status:null;});
 const working=currentJobs.filter(status=>status==='QUEUED'||status==='PROCESSING').length;
 const ready=currentJobs.filter(status=>status==='READY').length,review=currentJobs.filter(status=>status==='REVIEW'||status==='FAILED').length+unTimed.filter(page=>page.audioCueMode==='PARTIAL').length;
 const step=(id:SetupStepId,status:SetupState,required:boolean,completed:number,total:number,detail:string,missing:SetupPage[]=[]):SetupStep=>({id,status,required,completed,total,remaining:Math.max(0,total-completed),pageNumbers:missing.slice(0,12).map(page=>page.number),detail});
 const imageOnly=pages.length>0&&nonImage.length===0;
 const stages:SetupStep[]=[
  step('metadata',missingMetadata.length?'todo':'done',true,3-missingMetadata.length,3,missingMetadata.length?`ثبت کن: ${missingMetadata.join('، ')}.`:'عنوان، نویسنده و دسته‌بندی ذخیره شده‌اند.'),
  step('pages',imported&&['QUEUED','PROCESSING'].includes(imported.status)?'working':imported?.status==='REVIEW'||imported?.status==='FAILED'?'review':pages.length?'done':'todo',true,pages.length,pages.length||1,imported?.status==='REVIEW'?'فایل آمادهٔ بازبینی است؛ «افزودن همهٔ صفحه‌ها به کتاب» را بزن.':imported?.status==='FAILED'?'پردازش فایل ناموفق بود؛ نتیجه را در ورود فایل بررسی کن.':imported&&['QUEUED','PROCESSING'].includes(imported.status)?`پردازش فایل: ${fa(imported.completedPages)} از ${fa(imported.totalPages)} صفحه؛ هنوز به کتاب اضافه نشده.`:pages.length?`${fa(pages.length)} صفحه در کتاب ثبت شده است.`:'هنوز صفحه‌ای در کتاب ثبت نشده است.'),
  step('cover',book.coverAssetId?'done':'optional',false,book.coverAssetId?1:0,1,book.coverAssetId?'تصویر جلد به کتاب وصل و ذخیره شده است.':'تصویر جلد اختصاصی ثبت نشده؛ جلد گرافیکی فعال است.'),
  step('text',imageOnly?'optional':!pages.length?'todo':textMissing.length?'todo':'done',!imageOnly,nonImage.length-textMissing.length,nonImage.length,!pages.length?'ابتدا صفحه‌های کتاب را ثبت کن.':imageOnly?'صفحه‌ها روی «فقط تصویر» هستند؛ زیرنویس متنی لازم نیست.':`${fa(nonImage.length-textMissing.length)} از ${fa(nonImage.length)} صفحهٔ غیرتصویری متن دارند${textMissing.length?`؛ ${fa(textMissing.length)} صفحه هنوز خالی است.`:'.'}`,textMissing),
  step('audio',waitingAudio?'working':!pages.length?'todo':!audioTarget.length?'optional':audioMissing.length?'todo':'done',!pages.length||audioTarget.length>0||waitingAudio>0,audioTarget.length-audioMissing.length,audioTarget.length,!pages.length?'پس از ثبت صفحه‌ها، پوشهٔ ویس‌ها را وارد کن.':!audioTarget.length?(waitingAudio?`${fa(waitingAudio)} فایل در ورود گروهی هنوز به صفحه‌ها متصل نشده است.`:'صفحه‌ها فقط تصویری‌اند و ویسی برای آن‌ها ثبت نشده است.'):`${fa(audioTarget.length-audioMissing.length)} از ${fa(audioTarget.length)} صفحهٔ قابل روایت ویس دارند${waitingAudio?`؛ ${fa(waitingAudio)} فایل در ورود گروهی هنوز متصل نشده است.`:audioMissing.length?`؛ ${fa(audioMissing.length)} صفحه ویس ندارد.`:'.'}`,audioMissing),
  step('alignment',imageOnly?'optional':!narrated.length?'todo':!unTimed.length?'done':ready||review?'review':working?'working':'todo',!imageOnly,narrated.length-unTimed.length,narrated.length,imageOnly?'برای صفحه‌های «فقط تصویر»، زمان‌بندی زیرنویس لازم نیست.':!narrated.length?'ابتدا ویس‌ها را ثبت کن؛ سپس زمان‌بندی زیرنویس بررسی می‌شود.':`${fa(narrated.length-unTimed.length)} از ${fa(narrated.length)} صفحهٔ دارای ویس، زمان‌بندی ثبت‌شده دارند.${ready?` ${fa(ready)} پیشنهاد منتظر اعمال است.`:''}${working?` ${fa(working)} صفحه در حال پردازش است.`:''}${review?` زمان‌بندی‌های ناقص یا ناموفق نیاز به بازبینی دارند.`:''}`,unTimed),
  step('contents',invalidContents?'review':contents.length?'done':'optional',false,contents.length,book.contents.length||1,invalidContents?`${fa(invalidContents)} عنوان فهرست صفحهٔ مقصد معتبر ندارد.`:contents.length?`${fa(contents.length)} عنوان با مقصد معتبر ذخیره شده است.`:'فهرست هنوز ثبت نشده است؛ این بخش اختیاری است.'),
  step('publish',book.status==='PUBLISHED'?'done':'todo',true,book.status==='PUBLISHED'?1:0,1,book.status==='PUBLISHED'?'وضعیت ذخیره‌شدهٔ کتاب «منتشرشده» است.':'پس از بازبینی، وضعیت کتاب را «منتشرشده» کن و ذخیره کن.'),
 ];
 const required=stages.filter(stage=>stage.required),next=stages.find(stage=>stage.status!=='done'&&(stage.required||stage.status==='review'||stage.status==='working'))||null;
 return {steps:stages,completed:required.filter(stage=>stage.status==='done').length,total:required.length,nextStep:next?.id||null,checkedAt:new Date().toISOString()};
}
