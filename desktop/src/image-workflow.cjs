'use strict';
const crypto=require('node:crypto');
const comicPage=require('./comic-page.cjs');
function fingerprint(page,scene){return crypto.createHash('sha256').update(page.content+'\0'+scene.start+'\0'+scene.end).digest('hex');}
function pendingTasks(project,scope='page',mode='scenes'){
 if(!['scene','page','book'].includes(scope))throw Error('محدودهٔ تصویرسازی معتبر نیست.');
 if(!['scenes','sheet'].includes(mode))throw Error('روش تصویرسازی معتبر نیست.');
 const current=project.pages.find(p=>p.number===project.selected),selected=current?.selectedScene||current?.scenes?.[0]?.id;
 if(mode==='sheet'&&scope!=='scene'){
  if(project.presentation!=='COMIC')throw Error('روش صفحه‌به‌صفحه برای قالب کمیک است؛ برای پلان‌های متوالی روش پلان‌به‌پلان را انتخاب کن.');
  return project.pages.filter(p=>(scope==='book'||p.number===project.selected)&&p.scenes?.length&&!comicPage.sheetDone(p)).map(page=>{if(page.scenes.some(s=>s.layered))throw Error('صفحهٔ '+page.number.toLocaleString('fa-IR')+' لایهٔ شخصیت جدا دارد؛ برای حفظ لایه‌ها از روش پلان‌به‌پلان استفاده کن.');return comicPage.pageTask(page);});
 }
 return project.pages.filter(p=>scope==='book'||p.number===project.selected).flatMap(page=>(page.scenes||[]).filter(scene=>scope!=='scene'||scene.id===selected).flatMap(scene=>['image',...(scene.layered?['foreground']:[])].filter(asset=>!scene[asset]).map(asset=>({number:page.number,sceneId:scene.id,asset,fingerprint:fingerprint(page,scene)}))));
}
function targetFor(project,task){if(task.asset==='sheet'){const page=comicPage.pageTarget(project,task);return {page,scene:page.scenes[0]};}const page=project.pages.find(p=>p.number===task.number),scene=page?.scenes?.find(s=>s.id===task.sceneId);if(!scene||fingerprint(page,scene)!==task.fingerprint)throw Error('متن یا کادرِ در حال ساخت تغییر کرده است؛ تصویر قبلی و تنظیمات حفظ شدند.');return {page,scene};}
function imageKey(url){try{const u=new URL(url);return u.protocol==='blob:'?url:u.origin+u.pathname+'?id='+(u.searchParams.get('id')||u.searchParams.get('file_id')||'');}catch{return url;}}

class ImageWorkflow{
 constructor(deps){this.deps=deps;this.status='idle';this.tasks=[];this.done=0;this.flight=null;this.running=null;this.message='';this.projectId=null;this.retries=0;}
 state(){return {status:this.status,total:this.total||0,done:this.done,current:this.tasks[0]||null,message:this.message,elapsed:this.flight?Math.floor((Date.now()-this.flight.started)/1000):0};}
 tell(message){this.message=message;this.deps.notify(this.state());}
 start(project,scope,mode='scenes'){
  if(this.running||this.status==='paused')throw Error('صف قبلی را ادامه بده یا پایان بده.');
  this.tasks=pendingTasks(project,scope,mode);this.total=this.tasks.length;this.done=0;this.projectId=project.id;this.flight=null;this.retries=0;this.status=this.tasks.length?'running':'complete';this.tell(this.tasks.length?(mode==='sheet'&&scope!=='scene'?'ساخت صفحه‌به‌صفحه شروع شد؛ یک درخواست برای تمام پلان‌های هر صفحه.':'تصویرسازی پلان‌به‌پلان شروع شد.'):'همهٔ تصویرهای این محدوده قبلاً آماده‌اند.');return this.launch();
 }
 resume(){if(this.status!=='paused'||this.running)throw Error('صف هنوز در حال توقف است؛ کمی بعد ادامه را بزن.');if(this.flight)this.flight.started=Date.now();this.retries=0;this.status='running';this.tell('ادامهٔ صف تصویرسازی');return this.launch();}
 pause(){if(this.status==='running'){this.status='paused';this.tell('صف متوقف شد؛ تصاویر آماده و درخواستِ در حال ساخت حفظ می‌شوند.');}}
 stop(){this.pause();if(this.running)throw Error('ابتدا صبر کن توقف کامل شود، سپس پایان صف را بزن.');this.status='idle';this.tasks=[];this.flight=null;this.tell('صف پایان یافت؛ تصویرهای ذخیره‌شده حفظ شدند.');}
 launch(){this.running=this.runWithRetries().catch(error=>{this.status='paused';this.tell(error.message||'تصویرسازی متوقف شد.');}).finally(()=>{this.running=null;this.deps.notify(this.state());});return this.running;}
 async runWithRetries(){
  while(this.status==='running')try{return await this.run();}catch(error){
   const transient=/network|connection|fetch|ERR_(?:INTERNET|NETWORK|CONNECTION|TIMED|NAME)|دانلود|دریافت تصویر|کادر نوشتن چت پیدا نشد|دکمهٔ ارسال چت هنوز آماده|قرارگرفتن دستور در چت تأیید نشد|نتیجهٔ ارسال هنوز مشخص|Send not ready|Result uncertain/i.test(error.message||'');
   if(this.status!=='running'||!transient||this.retries>=2)throw error;
   this.retries++;this.tell(`اتصال موقتاً کامل نشد؛ تلاش خودکار ${this.retries.toLocaleString('fa-IR')} از ۲. درخواستِ ارسال‌شده دوباره فرستاده نمی‌شود.`);await this.deps.delay(1000*2**(this.retries-1));
  }
 }
 checked(){const p=this.deps.project();if(!p||p.id!==this.projectId)throw Error('پروژه عوض شده است؛ صف به کتاب دیگری متصل نشد.');return p;}
 async run(){
  while(this.status==='running'&&this.tasks.length){
   const task=this.tasks[0],project=this.checked(),{page,scene}=targetFor(project,task);
   if(task.asset==='sheet'?comicPage.sheetDone(page):scene[task.asset]){this.tasks.shift();this.done++;this.flight=null;continue;}
   if(!this.flight?.submitted){
    await this.deps.select(page,scene);if(this.status!=='running')return;
    const prompt=this.deps.prompt(project,page,scene,task.asset);
    await this.deps.prepare(prompt,{page,scene,asset:task.asset});if(this.status!=='running')return;
    const baseline=await this.deps.scan();
    // Remember before submission so a timeout or pause never resends a prompt.
    this.flight={prompt,baseline:baseline.images.map(imageKey),started:Date.now(),submitted:false,candidate:null,stable:0};
    this.tell(task.asset==='sheet'?`در انتظار یک تصویر برای تمام ${page.scenes.length.toLocaleString('fa-IR')} پلان صفحهٔ ${page.number.toLocaleString('fa-IR')}`:`در انتظار ساخت تصویر صفحهٔ ${page.number.toLocaleString('fa-IR')}؛ ${task.asset==='foreground'?'شخصیت':'کادر'} ${((page.scenes||[]).indexOf(scene)+1).toLocaleString('fa-IR')}`);
    await this.deps.submit(prompt,()=>{this.flight.submitted=true;});this.flight.submitted=true;
   }
   while(this.status==='running'){
    targetFor(this.checked(),task);
    const result=await this.deps.scan(this.flight.prompt);await this.deps.rememberChat();
    if(result.error)throw Error('چت‌جی‌پی‌تی محدودیت یا خطای تولید نشان داد؛ پس از رفع آن ادامه را بزن.');
    const url=result.promptMatches===false?null:result.images.filter(url=>!this.flight.baseline.includes(imageKey(url))).at(-1);
    if(url&&!result.pending){this.flight.stable=this.flight.candidate===url?this.flight.stable+1:1;this.flight.candidate=url;if(this.flight.stable>=2)break;}
    if(Date.now()-this.flight.started>15*60*1000)throw Error('ساخت تصویر بیش از ۱۵ دقیقه طول کشید؛ چت را بررسی کن. درخواست دوباره خودکار ارسال نمی‌شود.');
    this.deps.notify(this.state());await this.deps.delay(1500);
   }
   if(this.status!=='running')return;
   this.tell('تصویر ساخته شد؛ در حال دریافت و ذخیره در کادر درست…');
   await this.deps.download(this.flight.candidate,task,this.projectId);
   this.tasks.shift();this.done++;this.flight=null;this.retries=0;
   this.tell(`${this.done.toLocaleString('fa-IR')} از ${this.total.toLocaleString('fa-IR')} تصویر ذخیره شد.`);
  }
  if(this.status==='running'){this.status='complete';this.tell('تصویرسازی این محدوده کامل شد؛ تصویرها روی همین دستگاه ذخیره شدند.');}
 }
}
module.exports={ImageWorkflow,pendingTasks,targetFor,imageKey};
