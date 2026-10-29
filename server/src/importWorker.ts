import {config} from './config';
import prisma from './lib/prisma';
import {extractDocument,ImportSource} from './services/documentExtraction';
let stopping=false,activeJob:string|null=null;
async function shutdown(){if(stopping)return;stopping=true;try{if(activeJob)await prisma.bookImport.updateMany({where:{id:activeJob,status:'PROCESSING'},data:{status:'QUEUED',attempts:{decrement:1}}});}finally{await prisma.$disconnect();process.exit(0);}}
process.once('SIGTERM',()=>void shutdown());process.once('SIGINT',()=>void shutdown());

async function run(){
  // A service restart resumes from the last completely stored page.
  await prisma.bookImport.updateMany({where:{status:'PROCESSING',attempts:{gte:3}},data:{status:'FAILED',error:'پردازش چند بار متوقف شد. فایل را به بخش‌های کوچک‌تر تقسیم کنید یا ساختار آن را بررسی کنید.'}});
  await prisma.bookImport.updateMany({where:{status:'PROCESSING'},data:{status:'QUEUED'}});
  while(!stopping){
    const job=await prisma.bookImport.findFirst({where:{status:'QUEUED'},orderBy:{createdAt:'asc'},include:{book:true}});
    if(!job){await new Promise(resolve=>setTimeout(resolve,1500));continue;}
    const claimed=await prisma.bookImport.updateMany({where:{id:job.id,status:'QUEUED'},data:{status:'PROCESSING',error:null,attempts:{increment:1}}});if(!claimed.count)continue;activeJob=job.id;
    try{
      if(job.book.status==='TRASH'){await prisma.bookImport.update({where:{id:job.id},data:{status:'CANCELED'}});continue;}
      const sources=JSON.parse(job.sources) as ImportSource[];
      if(!sources.length)throw new Error('فایل منبع پیدا نشد.');
      const canceled=async()=>{const latest=await prisma.bookImport.findUnique({where:{id:job.id},include:{book:{select:{status:true}}}});return !latest||latest.status==='CANCELED'||latest.book.status==='TRASH';};
      let count=job.completedPages;
      const save=async(page:any)=>{
        if(page.content.length>40000)throw new Error('متن یکی از صفحه‌ها بیش از حد بزرگ است.');
        await prisma.$transaction([prisma.importedPage.upsert({where:{importId_number:{importId:job.id,number:page.number}},create:{...page,importId:job.id},update:page}),prisma.bookImport.update({where:{id:job.id},data:{completedPages:page.number}})]);count=page.number;
      };
      if(sources.length>1||sources[0].mimeType.startsWith('image/')){
        await prisma.bookImport.update({where:{id:job.id},data:{totalPages:sources.length,warnings:job.mode==='images'?'فقط تصویرها وارد می‌شوند؛ متن آماده را جداگانه تطبیق دهید.':'متن عکس‌ها با OCR استخراج شده است؛ پیش از انتشار بازبینی کنید.'}});
        for(let i=job.completedPages;i<sources.length;i++){if(await canceled())break;await extractDocument(sources[i],config.mediaDirectory,job.mode==='images'?'images':'ocr',async()=>{},page=>save({...page,number:i+1}),canceled);}
      }else await extractDocument(sources[0],config.mediaDirectory,job.mode,async(totalPages,warnings)=>{await prisma.bookImport.update({where:{id:job.id},data:{totalPages,warnings}});},save,canceled,job.completedPages);
      if(await canceled())await prisma.bookImport.update({where:{id:job.id},data:{status:'CANCELED'}});
      else await prisma.bookImport.update({where:{id:job.id},data:{status:'REVIEW',completedPages:count}});
      console.log('BonBook import completed:',job.id,count);
    }catch(error){if(!stopping){const message=error instanceof Error?error.message:'پردازش فایل انجام نشد.';await prisma.bookImport.update({where:{id:job.id},data:{status:'FAILED',error:message.slice(0,500)}});console.error('BonBook import failed:',job.id,message.slice(0,150));}}finally{activeJob=null;}
  }
}
run().catch(error=>{console.error('BonBook import worker stopped:',error instanceof Error?error.name:'error');process.exitCode=1;}).finally(()=>prisma.$disconnect());
