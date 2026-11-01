import crypto from 'crypto';
import prisma from '../lib/prisma';
import {HttpError} from '../lib/httpError';
import {contentHash,readingLines,recognizeSpeech,reusableSpeech} from './speechService';
import {planSmartReview} from './smartReviewPolicy';
const MODEL='bonbook-smart-review-v1';
export async function addReviewItem(tx:any,run:any,source:any,page:any){
 if(source.audioAssetId!==page.audioAssetId||!page.audioAssetId||!page.content.trim())return false;
 if(await tx.audioReviewItem.findUnique({where:{sourceAlignmentId:source.id}}))return false;
 await tx.audioReviewItem.create({data:{id:crypto.randomUUID(),runId:run.id,pageId:page.id,pageNumber:page.number,sourceAlignmentId:source.id,audioAssetId:page.audioAssetId,contentHash:contentHash(page.content),beforeCues:page.audioCues,beforeMode:page.audioCueMode}});return true;
}
export async function startSmartReview(bookId:number,userId:number){return prisma.$transaction(async tx=>{
 const book=await tx.libraryBook.findUnique({where:{id:bookId}});if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');
 await tx.libraryBook.update({where:{id:bookId},data:{smartAudioReview:true}});
 const running=await tx.audioReviewRun.findFirst({where:{bookId,status:{in:['QUEUED','PROCESSING']}},orderBy:{createdAt:'desc'}});
 if(running)return running;
 const previous=await tx.audioReviewRun.findFirst({where:{bookId},orderBy:{createdAt:'desc'}});
 const pages=await tx.libraryPage.findMany({where:{bookId,audioAssetId:{not:null}},include:{alignments:{orderBy:{createdAt:'desc'},take:1}}});
 const candidates=pages.filter(page=>page.alignments[0]&&['REVIEW','READY'].includes(page.alignments[0].status)&&page.alignments[0].model!==MODEL);
 const seen=new Set((await tx.audioReviewItem.findMany({where:{sourceAlignmentId:{in:candidates.map(page=>page.alignments[0].id)}},select:{sourceAlignmentId:true}})).map(item=>item.sourceAlignmentId));
 if(previous&&previous.status!=='RESTORED'&&candidates.every(page=>seen.has(page.alignments[0].id))){
  const retried=await tx.audioReviewItem.updateMany({where:{runId:previous.id,status:{in:['FAILED','SKIPPED']}},data:{status:'WAITING',message:''}});
  return retried.count?tx.audioReviewRun.update({where:{id:previous.id},data:{status:'QUEUED'}}):previous;
 }
 const run=await tx.audioReviewRun.create({data:{id:crypto.randomUUID(),bookId,createdById:userId}});let count=0;
 for(const page of pages){const source=page.alignments[0];if(source&&['REVIEW','READY'].includes(source.status)&&source.model!==MODEL&&await addReviewItem(tx,run,source,page))count++;}
 return count?run:tx.audioReviewRun.update({where:{id:run.id},data:{status:'COMPLETE'}});
 },{timeout:20000});}
export async function queueFutureSmartReview(sourceId:string){return prisma.$transaction(async tx=>{
 const source=await tx.audioAlignment.findUnique({where:{id:sourceId},include:{page:{include:{book:true}}}});
 if(!source||source.status!=='REVIEW'||source.model===MODEL||!source.page.book.smartAudioReview||source.page.book.status==='TRASH')return;
 const run=await tx.audioReviewRun.findFirst({where:{bookId:source.page.bookId,status:{notIn:['CANCELED','RESTORED']}},orderBy:{createdAt:'desc'}});
 if(run&&await addReviewItem(tx,run,source,source.page))await tx.audioReviewRun.update({where:{id:run.id},data:{status:'QUEUED'}});
 });}
export async function getSmartReview(bookId:number){
 const book=await prisma.libraryBook.findUnique({where:{id:bookId},select:{status:true,smartAudioReview:true}});if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');
 const run=await prisma.audioReviewRun.findFirst({where:{bookId},orderBy:{createdAt:'desc'},include:{items:{orderBy:{pageNumber:'asc'},select:{id:true,pageNumber:true,status:true,report:true,message:true}}}});
 return {enabled:book.smartAudioReview,run:run?{...run,items:run.items.map(item=>({...item,report:JSON.parse(item.report)}))}:null};
}
let recovered=false;
export async function processNextSmartReview(stopping:()=>boolean=()=>false):Promise<boolean>{
 if(!recovered){await prisma.audioReviewItem.updateMany({where:{status:'WORKING',run:{status:{in:['QUEUED','PROCESSING']}}},data:{status:'WAITING'}});recovered=true;}
 const item=await prisma.audioReviewItem.findFirst({where:{status:'WAITING',run:{status:{in:['QUEUED','PROCESSING']}}},orderBy:{run:{createdAt:'asc'}},include:{run:true}});if(!item)return false;
 if(!(await prisma.audioReviewItem.updateMany({where:{id:item.id,status:'WAITING'},data:{status:'WORKING'}})).count)return true;
 await prisma.audioReviewRun.update({where:{id:item.runId},data:{status:'PROCESSING'}});
 const canceled=async()=>stopping()||(await prisma.audioReviewRun.findUnique({where:{id:item.runId},select:{status:true}}))?.status==='CANCELED';
 try{
  const page=await prisma.libraryPage.findUnique({where:{id:item.pageId},include:{audio:true,book:true}});
  if(!page||page.book.status==='TRASH'||page.audioAssetId!==item.audioAssetId||contentHash(page.content)!==item.contentHash||page.audioCues!==item.beforeCues||page.audioCueMode!==item.beforeMode){await prisma.audioReviewItem.update({where:{id:item.id},data:{status:'CHANGED',message:'متن، ویس یا زمان‌بندی پس از شروع بازبینی تغییر کرده است؛ تغییر جدید حفظ شد.'}});return true;}
  const input={id:item.id,audioAssetId:item.audioAssetId,audio:page.audio,page};
  if(!await reusableSpeech(input)){await prisma.audioReviewItem.update({where:{id:item.id},data:{status:'UNRESOLVED',message:'تشخیص ذخیره‌شدهٔ معتبر کافی نیست؛ زمان‌بندی قبلی حفظ شد.'}});return true;}
  const result=await recognizeSpeech(input,async()=>{},canceled),lines=readingLines(page.content),plan=planSmartReview(page.content,item.audioAssetId,item.beforeCues,item.beforeMode,result,lines);
  if(await canceled())throw new Error('Review canceled');
  await prisma.$transaction(async tx=>{
   const current=await tx.libraryPage.findUnique({where:{id:item.pageId},include:{book:true}}),run=await tx.audioReviewRun.findUnique({where:{id:item.runId}});
   if(run?.status==='CANCELED'||!current||current.book.status==='TRASH'||current.audioAssetId!==item.audioAssetId||contentHash(current.content)!==item.contentHash||current.audioCues!==item.beforeCues||current.audioCueMode!==item.beforeMode){await tx.audioReviewItem.update({where:{id:item.id},data:{status:'CHANGED',message:'تغییر تازهٔ صفحه حفظ شد؛ بازبینی روی آن اعمال نشد.'}});return;}
   const changed=['FIXED','PARTIAL'].includes(plan.status);
   if(changed)await tx.libraryPage.update({where:{id:item.pageId},data:{audioCues:plan.cues,audioCueMode:plan.mode}});
   const alignment=await tx.audioAlignment.create({data:{id:crypto.randomUUID(),pageId:item.pageId,audioAssetId:item.audioAssetId,contentHash:item.contentHash,previousCues:item.beforeCues,status:plan.status==='UNRESOLVED'?'REVIEW':'APPLIED',model:MODEL,progress:1,coverage:result.coverage,lineCoverage:result.lineCoverage,duration:result.duration,words:JSON.stringify(result.words),cues:plan.cues,warning:plan.message,createdById:item.run.createdById}});
   await tx.audioReviewItem.update({where:{id:item.id},data:{status:plan.status,afterCues:plan.cues,afterMode:plan.mode,alignmentId:alignment.id,report:JSON.stringify({added:plan.added,preserved:plan.preserved,unresolved:plan.unresolved,coverage:result.coverage,lineCoverage:result.lineCoverage}),message:plan.message}});
  });
  console.log('BonBook smart audio review:',item.run.bookId,item.pageNumber,plan.status,'added',plan.added,'kept',plan.preserved);
 }catch(error){await prisma.audioReviewItem.updateMany({where:{id:item.id,status:'WORKING'},data:stopping()?{status:'WAITING'}:{status:'FAILED',message:(await canceled())?'بازبینی متوقف شد؛ زمان‌بندی قبلی حفظ شد.':'بازبینی انجام نشد؛ زمان‌بندی قبلی حفظ شد.'}});}
 finally{
  const waiting=await prisma.audioReviewItem.count({where:{runId:item.runId,status:{in:['WAITING','WORKING']}}});
  if(!waiting)await prisma.audioReviewRun.updateMany({where:{id:item.runId,status:{in:['QUEUED','PROCESSING']}},data:{status:'COMPLETE'}});
 }
 return true;
}
export async function stopSmartReview(bookId:number){return prisma.$transaction(async tx=>{
 await tx.libraryBook.update({where:{id:bookId},data:{smartAudioReview:false}});
 await tx.audioReviewRun.updateMany({where:{bookId,status:{in:['QUEUED','PROCESSING']}},data:{status:'CANCELED'}});
 await tx.audioReviewItem.updateMany({where:{run:{bookId,status:'CANCELED'},status:'WAITING'},data:{status:'SKIPPED',message:'بازبینی متوقف شد؛ زمان‌بندی قبلی حفظ شد.'}});
 });}
export async function undoSmartReview(bookId:number,runId:string){return prisma.$transaction(async tx=>{
 const run=await tx.audioReviewRun.findFirst({where:{id:runId,bookId},include:{items:true}});if(!run)throw new HttpError(404,'بازبینی پیدا نشد.');
 if(await tx.audioReviewRun.count({where:{bookId,status:{in:['QUEUED','PROCESSING']}}}))throw new HttpError(409,'ابتدا بازبینی جاری را متوقف کن.');
 let restored=0,skipped=0;
 for(const item of run.items){if(!['FIXED','PARTIAL'].includes(item.status))continue;
  const page=await tx.libraryPage.findUnique({where:{id:item.pageId},include:{book:true}});
  if(!page||page.book.status==='TRASH'||page.audioAssetId!==item.audioAssetId||contentHash(page.content)!==item.contentHash||page.audioCues!==item.afterCues||page.audioCueMode!==item.afterMode){skipped++;continue;}
  await tx.libraryPage.update({where:{id:item.pageId},data:{audioCues:item.beforeCues,audioCueMode:item.beforeMode}});
  await tx.audioReviewItem.update({where:{id:item.id},data:{status:'RESTORED',message:'زمان‌بندی پیش از بازبینی برگردانده شد.'}});
  if(item.alignmentId)await tx.audioAlignment.updateMany({where:{id:item.alignmentId},data:{status:'CANCELED',warning:'اصلاح هوشمند برگردانده شد.'}});restored++;
 }
 await tx.libraryBook.update({where:{id:bookId},data:{smartAudioReview:false}});
 await tx.audioReviewRun.update({where:{id:runId},data:{status:'RESTORED'}});return {restored,skipped};
 },{timeout:20000});}
