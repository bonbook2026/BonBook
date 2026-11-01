import {AudioAlignment,SpeechQueueState} from '../types';
export const alignmentStatus:Record<AudioAlignment['status'],string>={QUEUED:'در صف تشخیص گفتار',PROCESSING:'در حال شنیدن و تطبیق',READY:'آمادهٔ اعمال',REVIEW:'تشخیص تمام شد؛ نیاز به بازبینی',APPLIED:'زمان‌بندی اعمال شد',FAILED:'پردازش ناموفق',CANCELED:'لغو شد'};
type Job=AudioAlignment&{pageNumber:number};
const number=(value:number)=>value.toLocaleString('fa-IR');
export function SpeechQueueProgress({jobs,queue,refreshError,children,bookId}:{jobs:Job[];queue:SpeechQueueState|null;refreshError:string;children:React.ReactNode;bookId:number}){
 if(!jobs.length)return refreshError?<p className="notice error" role="alert">{refreshError}</p>:null;
 const count=(status:Job['status'])=>jobs.filter(job=>job.status===status).length;
 const completed=count('APPLIED')+count('READY')+count('REVIEW'),failed=count('FAILED'),total=jobs.length-count('CANCELED'),pending=count('QUEUED')+count('PROCESSING');
 const progress=total?Math.min(1,(completed+failed+jobs.filter(job=>job.status==='PROCESSING').reduce((sum,job)=>sum+job.progress,0))/total):0;
 const priority=(job:Job)=>job.status==='PROCESSING'?0:job.status==='QUEUED'?1:2;
 const sorted=[...jobs].sort((a,b)=>priority(a)-priority(b)||(a.queuePosition??Number.MAX_SAFE_INTEGER)-(b.queuePosition??Number.MAX_SAFE_INTEGER)||a.pageNumber-b.pageNumber);
 return <section className="batch-results speech-queue-progress" aria-label="پیشرفت تشخیص گفتار کتاب">
  <div className="speech-progress-heading"><h3>پیشرفت تشخیص گفتار کتاب</h3><strong>{number(Math.floor(progress*1000)/10)}٪</strong></div>
  <progress aria-label="پیشرفت کل تشخیص گفتار" max={1} value={progress}/>
  <p>{number(completed)} از {number(total)} صفحه بررسی شده{failed?' · '+number(failed)+' ناموفق':''}</p>
  <ul className="speech-progress-counts"><li>{number(count('APPLIED'))} اعمال‌شده</li><li>{number(count('READY'))} پیشنهاد مطمئن</li><li>{number(count('REVIEW'))} برای بازبینی</li><li>{number(count('PROCESSING'))} در حال پردازش</li><li>{number(count('QUEUED'))} منتظر نوبت</li></ul>
  {refreshError?<p className="notice error" role="alert">{refreshError} آخرین وضعیت دریافت‌شده نمایش داده می‌شود.</p>:pending>0&&queue?<div className={'speech-worker-note'+(!queue.online?' warning':'')} role="status">
   {!queue.online?'موتور تشخیص گفتار فعلاً پاسخ نمی‌دهد؛ صف ذخیره شده است و با بازگشت موتور ادامه پیدا می‌کند.':queue.active?.bookId===bookId?`در حال بررسی صفحهٔ ${number(queue.active.pageNumber)} · ${number(Math.floor(queue.active.progress*100))}٪ از فایل جاری`:queue.active?`موتور در حال بررسی صفحهٔ ${number(queue.active.pageNumber)} از کتاب دیگری است. ${queue.nextPosition===2?'نوبت بعدی برای این کتاب است.':queue.nextPosition>0?`${number(queue.nextPosition-1)} فایل تا نوبت بعدی این کتاب.`:''}`:'صف آماده است؛ فایل بعدی در حال شروع است.'}
  </div>:null}
  <p className="speech-progress-help">{pending?'پردازش روی سرور ادامه دارد؛ می‌توانی این صفحه را ببندی. کتاب‌ها به نوبت بررسی می‌شوند.':'بررسی صف این کتاب تمام شده است.'}{count('REVIEW')>0?' «برای بازبینی» یعنی تشخیص تمام شده، اما بخشی از صدا و متن با اطمینان کامل تطبیق ندارد؛ زمان‌بندی قبلی حفظ شده است.':''}</p>
  {children}
  <div className="speech-job-list">{sorted.map(job=><div className="batch-result-row" key={job.id}><b>صفحهٔ {number(job.pageNumber)}</b><span>{alignmentStatus[job.status]}{job.status==='PROCESSING'?' · '+number(Math.floor(job.progress*100))+'٪':job.status==='QUEUED'&&job.queuePosition?' · نوبت '+number(job.queuePosition):''}</span><small>{job.progress===1?'تطبیق '+number(Math.round(job.coverage*100))+'٪ · ':''}{job.error||job.warning}</small></div>)}</div>
 </section>;
}
