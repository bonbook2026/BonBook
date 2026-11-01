import prisma from './lib/prisma';
import {applyAlignment,contentHash,recognizeSpeech} from './services/speechService';
import {normalizePersian} from './services/searchService';
import {fairSpeechOrder,readSpeechWorkerState,writeSpeechWorkerState,SpeechWorkerState} from './services/speechQueue';
import {processNextSmartReview,queueFutureSmartReview} from './services/smartAudioReview';
let stopping=false,activeJob:string|null=null;
const state:SpeechWorkerState={heartbeat:0,lastBookId:null,active:null};let heartbeat:NodeJS.Timeout|undefined,writes=Promise.resolve();
function publish(online=true){const value={...state,heartbeat:online?Date.now():0,active:state.active?{...state.active}:null};writes=writes.catch(()=>{}).then(()=>writeSpeechWorkerState(value));return writes;}
async function shutdown(){if(stopping)return;stopping=true;clearInterval(heartbeat);if(activeJob)await prisma.audioAlignment.updateMany({where:{id:activeJob,status:'PROCESSING'},data:{status:'QUEUED',attempts:{decrement:1}}});state.active=null;await publish(false).catch(()=>{});await prisma.$disconnect();process.exit(0);}
process.once('SIGTERM',()=>void shutdown());process.once('SIGINT',()=>void shutdown());
async function run(){
 state.lastBookId=(await readSpeechWorkerState())?.lastBookId??null;
 await prisma.audioAlignment.updateMany({where:{status:'PROCESSING',attempts:{gte:3}},data:{status:'FAILED',error:'پردازش چند بار متوقف شد. دوباره تلاش کنید یا فایل کوتاه‌تری انتخاب کنید.'}});
 await prisma.audioAlignment.updateMany({where:{status:'PROCESSING'},data:{status:'QUEUED'}});
 await publish();heartbeat=setInterval(()=>{void publish().catch(()=>{});},10000);
 while(!stopping){
  if(await processNextSmartReview(()=>stopping))continue;
  const waiting=await prisma.audioAlignment.findMany({where:{status:'QUEUED'},orderBy:[{createdAt:'asc'},{id:'asc'}],select:{id:true,page:{select:{bookId:true}}}});
  const next=fairSpeechOrder(waiting.map(job=>({id:job.id,bookId:job.page.bookId})),state.lastBookId)[0];
  const job=next?await prisma.audioAlignment.findUnique({where:{id:next.id},include:{audio:true,page:{include:{book:true}}}}):null;
  if(!job){await new Promise(resolve=>setTimeout(resolve,2000));continue;}
  if(!(await prisma.audioAlignment.updateMany({where:{id:job.id,status:'QUEUED'},data:{status:'PROCESSING',error:null,progress:0,attempts:{increment:1}}})).count)continue;
  activeJob=job.id;
  state.lastBookId=job.page.bookId;state.active={id:job.id,bookId:job.page.bookId,pageNumber:job.page.number,progress:0,startedAt:Date.now()};await publish();
  console.log('BonBook speech alignment started:',job.id,'book',job.page.bookId,'page',job.page.number);
  const canceled=async()=>{if(stopping)return true;const latest=await prisma.audioAlignment.findUnique({where:{id:job.id},include:{page:{include:{book:true}}}});return !latest||latest.status==='CANCELED'||latest.page.book.status==='TRASH'||latest.page.audioAssetId!==job.audioAssetId||contentHash(latest.page.content)!==job.contentHash;};
  try{
   if(await canceled()){await prisma.audioAlignment.updateMany({where:{id:job.id},data:{status:'CANCELED',warning:'متن یا ویس تغییر کرده است.'}});continue;}
   const result=await recognizeSpeech(job,async progress=>{await prisma.audioAlignment.updateMany({where:{id:job.id,status:'PROCESSING'},data:{progress}});if(state.active?.id===job.id)state.active.progress=progress;await publish();},canceled);
   if(await canceled()){await prisma.audioAlignment.updateMany({where:{id:job.id},data:{status:'CANCELED'}});continue;}
   if(!Array.isArray(result.words)||!Array.isArray(result.cues)||!Number.isFinite(result.coverage)||!Number.isFinite(result.lineCoverage))throw new Error('نتیجهٔ تشخیص گفتار معتبر نیست.');
   const candidates:{pageNumber:number;score:number;heading:string}[]=[];
   if(result.coverage<.6){
    const spoken=new Set<string>(normalizePersian(result.words.slice(0,1000).map((word:any)=>word.text).join(' ')).split(' ').filter((word:string)=>word.length>2));
    const pages=await prisma.libraryPage.findMany({where:{bookId:job.page.bookId},select:{number:true,heading:true,content:true},take:2000});
    for(const page of pages){if(page.number===job.page.number)continue;const words=new Set(normalizePersian(page.content).split(' ').filter(word=>word.length>2));let common=0;for(const word of spoken)if(words.has(word))common++;const score=2*common/Math.max(1,spoken.size+words.size);if(score>.25)candidates.push({pageNumber:page.number,score:Math.round(score*100)/100,heading:page.heading});}
    candidates.sort((a,b)=>b.score-a.score);
   }
   const warning=result.safe?job.previousCues==='[]'?'زمان‌بندی با تطبیق گفتار و متن ساخته شد.':'پیشنهاد مطمئن آماده شد؛ زمان‌بندی قبلی تا انتخاب «اعمال پیشنهاد» حفظ شده است.':result.words.length?'بخشی از گفتار با متن این صفحه تطبیق ندارد؛ پیشنهادها را بازبینی کنید.':'گفتار قابل تشخیص در فایل پیدا نشد.';
   await prisma.audioAlignment.update({where:{id:job.id},data:{status:result.safe?'READY':'REVIEW',progress:1,coverage:result.coverage,lineCoverage:result.lineCoverage,duration:result.duration,words:JSON.stringify(result.words),cues:JSON.stringify(result.cues),candidates:JSON.stringify(candidates.slice(0,3)),warning}});
   if(result.safe&&job.previousCues==='[]')try{await applyAlignment(job.id);}catch{await prisma.audioAlignment.update({where:{id:job.id},data:{status:'REVIEW',warning:'زمان‌بندی دستی در طول پردازش تغییر کرده است؛ پیشنهاد جدید را بازبینی کنید.'}});}
   await queueFutureSmartReview(job.id);
   console.log('BonBook speech alignment finished:',job.id,result.coverage,result.lineCoverage);
  }catch(error){if(!stopping){const canceledNow=await canceled();await prisma.audioAlignment.updateMany({where:{id:job.id,status:'PROCESSING'},data:{status:canceledNow?'CANCELED':'FAILED',error:canceledNow?null:(error instanceof Error?error.message:'تشخیص گفتار انجام نشد.').slice(0,400)}});}}
  finally{activeJob=null;state.active=null;await publish();}
 }
}
run().catch(error=>{console.error('BonBook speech worker stopped:',error instanceof Error?error.name:'error');process.exitCode=1;}).finally(async()=>{clearInterval(heartbeat);await publish(false).catch(()=>{});await prisma.$disconnect();});
