import {forwardRef,useEffect,useId,useImperativeHandle,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Icon} from './Icon';
import {BookSetupProgress,BookSetupStep,BookSetupStepId} from '../types';
import {useBookSetupProgress} from '../hooks/useBookSetupProgress';
import './book-setup-guide.css';

type GuideStep={title:string;location:string;view:string;action:string;anchor?:string;instructions:string[];tip?:string};
const steps:GuideStep[]=[
 {title:'شروع و مشخصات کتاب',location:'کتاب‌ها ← کتاب جدید',view:'details',action:'بازکردن مشخصات کتاب',instructions:[
  'در صفحهٔ «کتاب‌ها»، دکمهٔ «کتاب جدید» را بزن، نام کتاب را بنویس و «ساخت و ادامه» را انتخاب کن.',
  'در تب «مشخصات و جلد»، نام نویسنده و دسته‌بندی را وارد کن. توضیحات و برچسب‌ها در «برچسب‌ها و توضیحات بیشتر» هستند.',
  'برای آماده‌سازی یک کتاب تازه، وضعیت آن را «پیش‌نویس» بگذار و «ذخیرهٔ مشخصات و وضعیت» را بزن.',
 ],tip:'اگر همین حالا داخل یک کتاب هستی، کتاب ساخته شده است؛ مشخصاتش را بررسی کن و به مرحلهٔ بعد برو.'},
 {title:'ورود PDF و صفحه‌ها',location:'تب «ورود فایل»',view:'import',action:'بازکردن ورود فایل',instructions:[]},
 {title:'بارگذاری و تنظیم جلد',location:'تب «مشخصات و جلد» ← تصویر جلد',view:'details',anchor:'book-cover-settings',action:'بازکردن تنظیمات جلد',instructions:[
  'بخش «تصویر جلد و تنظیم پشت و رو» را باز کن و «بارگذاری تصویر جلد» را بزن.',
  'اگر عکس فقط روی جلد است، «فقط روی جلد» را انتخاب کن. برای عکس کاملِ پشت، عطف و رو، گزینهٔ «تصویر کامل: پشت، عطف و رو» را بگذار.',
  'سمت روی جلد و مرزهای عطف را تنظیم کن. پیش‌نمایش جلد را لمس کن تا پشت آن را هم بررسی کنی.',
  'در پایین فرم، «ذخیرهٔ مشخصات و وضعیت» را بزن تا جلد به کتاب وصل شود.',
 ],tip:'برای این تصویر می‌توانی فایل JPG، PNG یا WebP تا ۸ مگابایت انتخاب کنی.'},
 {title:'افزودن متن آماده و زیرنویس',location:'تب «متن و زیرنویس»',view:'text',action:'بازکردن متن و زیرنویس',instructions:[
  'پس از ورود صفحه‌ها، «انتخاب متن کامل یا چند فایل» یا «انتخاب پوشهٔ متن صفحه‌ها» را بزن. متن آماده باید TXT یا MD باشد.',
  'برای فایل کامل، شمارهٔ هر صفحه را با قالب نمونهٔ زیر مشخص کن. برای فایل‌های جدا، نامی مثل page-0011.txt برای صفحهٔ ۱۱ بگذار.',
  'اگر شمارهٔ فایل با صفحهٔ کتاب یکی است، اختلاف را صفر بگذار. اگر متن ۱ مربوط به صفحهٔ ۵ PDF است، اختلاف ۴ را وارد کن.',
  '«ساخت پیش‌نمایش تطبیق» را بزن، شماره‌ها و چند نمونه را با «قبل و بعد» بررسی کن و سپس «جایگزینی متن … صفحهٔ انتخاب‌شده» را بزن.',
 ],tip:'در «فیلتر عبارت‌های اضافی متن» می‌توانی عبارتی مثل <short pause> را حذف کنی؛ هر عبارت در یک خط. فیلتر را پیش از ساخت پیش‌نمایش ذخیره کن. موارد نیازمند بازبینی را پس از مقایسه انتخاب کن.'},
 {title:'وصل‌کردن ویس‌ها به صفحه‌ها',location:'تب «صدا»',view:'audio',action:'بازکردن ورود گروهی ویس‌ها',instructions:[
  'نام فایل‌ها را بر اساس شمارهٔ صفحه بگذار؛ مثلاً 10.mp3 برای صفحهٔ ۱۰. سپس «انتخاب پوشهٔ ویس‌ها» یا «انتخاب چند فایل صوتی» را بزن.',
  'در پیش‌نمایش، صفحهٔ مقصد هر فایل را بررسی کن. موارد بدون شماره یا تکراری را اصلاح کن و در صورت نیاز «اختلاف شمارهٔ فایل و صفحه» را اعمال کن.',
  'اگر می‌خواهی زیرنویس هم خودکار با صدا هماهنگ شود، گزینهٔ «تشخیص گفتار و هماهنگی خودکار متن پس از اتصال» را فعال کن.',
  '«اتصال … ویس به صفحه‌ها» را بزن و نتیجهٔ فایل‌ها را بررسی کن. برای ادامهٔ یک بارگذاری ناتمام، همان پوشه را دوباره انتخاب کن و «ادامهٔ بارگذاری قبلی» را بزن.',
 ],tip:'جایگزینی ویس‌های قبلی را فقط زمانی فعال کن که قصد عوض‌کردن آن‌ها را داری. هر فایل صوتی حداکثر ۳۰ مگابایت است.'},
 {title:'هماهنگ‌کردن متن با صدا',location:'تب «صدا» ← تشخیص و تطبیق گروهی',view:'audio',anchor:'book-audio-alignment',action:'بازکردن هماهنگی متن و صدا',instructions:[
  'متن سالم و ویس‌ها را ثبت کن؛ اگر هنگام ورود ویس، هماهنگی خودکار را فعال کرده‌ای، پیشرفت همان پردازش را در تب «صدا» می‌بینی.',
  'برای ویس‌های قبلی، «تشخیص و تطبیق گروهی ویس‌های کتاب» را بزن. گزینهٔ بررسی ویس‌های دارای زمان‌بندی را فقط برای پردازش دوبارهٔ آن‌ها فعال کن.',
  'پس از پردازش، «اعمال پیشنهادهای مطمئن» را بزن. موارد «نیاز به بازبینی» را از صفحهٔ مربوط، بخش «صدا و زمان‌بندیِ همین صفحه» بررسی و اصلاح کن.',
  'یک روایت را در کتاب‌خوان پخش کن و دنبال‌شدن زیرنویس را ببین. اگر زمان‌ها را دستی اصلاح کردی، «ذخیرهٔ صفحه» را هم بزن.',
 ],tip:'اگر دکمهٔ تشخیص گفتار غیرفعال است، پیام همان بخش را بررسی کن. پیشنهادهای آماده باید با دکمهٔ اعمال ثبت شوند.'},
 {title:'ساخت فهرست مطالب',location:'تب «فهرست»',view:'contents',action:'بازکردن فهرست مطالب',instructions:[
  'عنوان فصل و شمارهٔ صفحهٔ مقصدش را وارد کن. برای ورود چند عنوان، از ابزار ورود یک‌جای فهرست با قالب «عنوان | شمارهٔ صفحه» استفاده کن.',
  'شماره‌ها را با صفحه‌های واردشدهٔ همین کتاب تطبیق بده؛ اگر شمارهٔ چاپی با PDF فرق دارد، اختلاف را در ابزار فهرست تنظیم کن.',
  'ترتیب و زیرعنوان‌ها را بررسی کن و «ذخیرهٔ فهرست» را بزن. یک عنوان را در کتاب‌خوان انتخاب کن تا مطمئن شوی به صفحهٔ درست می‌رود.',
 ],tip:'ثبت فهرست اختیاری است، اما برای کتاب‌های بلند پیدا کردن فصل‌ها را خیلی راحت‌تر می‌کند.'},
 {title:'انتشار کتاب',location:'پیش‌نمایش کتاب ← تب «مشخصات و جلد»',view:'details',anchor:'book-publication-settings',action:'بازکردن وضعیت انتشار',instructions:[
  'پیش‌نمایش کتاب را باز کن؛ روی جلد و پشت آن، چند صفحه از ابتدا و وسط و پایان، متن، فهرست و ویس‌ها را بررسی کن.',
  'پخش یک ویس و «پخش کامل» را امتحان کن و ببین زیرنویس، شمارهٔ صفحه و رفتن به روایت بعدی درست است.',
  'وقتی آماده شد، در «مشخصات و جلد»، گزینهٔ «نمایش کتاب برای کاربران» را روی «منتشرشده» بگذار و «ذخیرهٔ مشخصات و وضعیت» را بزن.',
  'کتابخانهٔ سایت را باز کن و نمایش کتاب را بررسی کن. برای آماده‌سازی بیشتر، وضعیت «پیش‌نویس» یا «مخفی» را انتخاب کن و ذخیره کن.',
 ],tip:'رفتن به مرحلهٔ بعد فقط راهنما را جلو می‌برد. فایل، متن، فهرست و وضعیت انتشار را در بخش مربوط به خودشان ثبت کن.'},
];
const stepIds:BookSetupStepId[]=['metadata','pages','cover','text','audio','alignment','contents','publish'];
const stepLabels=['مشخصات','صفحه‌ها','تصویر جلد','متن صفحه‌ها','ویس‌ها','زمان‌بندی صدا','فهرست','انتشار'];
const statusLabels={done:'انجام‌شده',todo:'باقی‌مانده',working:'در حال انجام',review:'نیاز به بررسی',optional:'اختیاری'};
const pdfInstructions=(prepared:boolean)=>[
 '«انتخاب فایل کتاب یا عکس صفحه‌ها» را بزن و PDF اصلی را انتخاب کن؛ هر نوبت تا ۳۰ مگابایت.',
 prepared?'چون متن آماده داری، در «روش خواندن فایل»، «فقط تصویر PDF یا عکس؛ بدون OCR» را انتخاب کن. تصویر صفحه‌ها از PDF وارد می‌شود و متن سالم را در مرحلهٔ «متن و زیرنویس» جدا وصل می‌کنی.':'در «روش خواندن فایل»، «خودکار؛ تشخیص نیاز به OCR» را انتخاب کن. برای PDF اسکن‌شده، متن با OCR استخراج می‌شود؛ برای فایل متنی، متن داخلی خوانده می‌شود.',
 'دکمهٔ بارگذاری را بزن و صبر کن وضعیت «آمادهٔ بازبینی» شود. پیش‌نمایش و شمارهٔ شروع در کتاب را بررسی کن؛ برای کتاب تازه، شمارهٔ شروع ۱ است.',
 '«افزودن همهٔ … صفحه به کتاب» را بزن. پس از این مرحله باید صفحه‌ها را در تب «صفحه‌ها» ببینی.',
];
type GuideState={step:number;open:boolean;prepared:boolean};
const readable=(text:string)=>text.split(/(<short pause>|page-\d+\.txt|\d+\.mp3|PDF|OCR|TXT|MD|JPG|PNG|WebP)/g).map((part,index)=>index%2?<bdi key={index} dir="ltr">{part}</bdi>:part);
function preference(key:string,book:boolean,empty:boolean):GuideState{
 const fallback={step:book?1:0,open:book&&empty,prepared:true};
 try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&typeof value==='object')return {step:Number.isInteger(value.step)&&value.step>=0&&value.step<steps.length?value.step:fallback.step,open:typeof value.open==='boolean'?value.open:fallback.open,prepared:typeof value.prepared==='boolean'?value.prepared:true};}catch{}
 return fallback;
}
export interface BookSetupGuideHandle{show:()=>void}
interface Props{bookId?:number;firstPage?:number;hasPages?:boolean;onGo?:(view:string,anchor?:string)=>void;onCreate?:()=>void;onPage?:(number:number)=>void}
export const BookSetupGuide=forwardRef<BookSetupGuideHandle,Props>(function BookSetupGuide({bookId,firstPage,hasPages,onGo,onCreate,onPage},ref){
 const storageKey=`bonbook_admin_book_guide_${bookId||'catalog'}`,region=useId(),root=useRef<HTMLElement>(null),list=useRef<HTMLDetailsElement>(null);
 const [state,setState]=useState(()=>preference(storageKey,Boolean(bookId),!hasPages));
 const {progress,error,checking,refresh}=useBookSetupProgress(bookId),previous=useRef<BookSetupProgress|null>(null);
 const saved=Object.fromEntries((progress?.steps||[]).map(step=>[step.id,step])) as Partial<Record<BookSetupStepId,BookSetupStep>>;
 const nextIndex=progress?.nextStep?stepIds.indexOf(progress.nextStep):-1,currentSaved=saved[stepIds[state.step]];
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}},[storageKey,state]);
 useEffect(()=>{
  if(!progress)return;const prior=previous.current;previous.current=progress;
  setState(old=>{const id=stepIds[old.step],now=progress.steps.find(step=>step.id===id),before=prior?.steps.find(step=>step.id===id),next=progress.nextStep?stepIds.indexOf(progress.nextStep):-1;
   return now?.status==='done'&&before?.status!=='done'&&next>=0&&next!==old.step?{...old,step:next}:old;
  });
 },[progress]);
 const scrollGuide=()=>window.requestAnimationFrame(()=>{root.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});root.current?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true});});
 useImperativeHandle(ref,()=>({show:()=>{setState(old=>({...old,open:true}));scrollGuide();}}),[]);
 const select=(step:number)=>{setState(old=>({...old,step}));if(list.current)list.current.open=false;};
 const showNext=()=>{if(nextIndex<0)return;setState(old=>({...old,step:nextIndex,open:true}));if(list.current)list.current.open=false;scrollGuide();};
 const current=steps[state.step],instructions=state.step===1?pdfInstructions(state.prepared):current.instructions;
 const action=()=>{if(!bookId){setState(old=>({...old,open:false}));onCreate?.();}else onGo?.(current.view,current.anchor);};
 const icon=(step?:BookSetupStep,index=0)=><span className={`setup-step-icon setup-${step?.status||'unknown'}`} aria-hidden="true">{step?.status==='done'?'✓':step?.status==='working'?'…':step?.status==='review'?'!':step?.status==='optional'?'—':(index+1).toLocaleString('fa-IR')}</span>;
 return <section ref={root} className={`admin-book-guide${state.open?' is-open':''}`} aria-label="راهنمای مرحله‌به‌مرحلهٔ افزودن کتاب">
  <header><span className="book-guide-icon"><Icon name="book"/></span><div><h2 tabIndex={-1}>افزودن کتاب، قدم‌به‌قدم</h2><p>از PDF و جلد تا متن آماده، ویس و انتشار</p></div><button type="button" aria-expanded={state.open} aria-controls={region} onClick={()=>setState(old=>({...old,open:!old.open}))}>{state.open?'بستن راهنما':'بازکردن راهنما'}<Icon name="chevron"/></button></header>
  {bookId&&<div className="book-setup-summary" aria-label="پیشرفت واقعی کتاب">
   {error?<div className="setup-progress-error" role="alert"><span>وضعیت کتاب بررسی نشد: {error}</span><button type="button" onClick={refresh} disabled={checking}>تلاش دوباره</button></div>:progress?<>
    <div className="setup-progress-heading"><strong>{progress.completed.toLocaleString('fa-IR')} از {progress.total.toLocaleString('fa-IR')} کار اصلی ثبت شده</strong><button type="button" onClick={refresh} disabled={checking} aria-label="بررسی دوبارهٔ پیشرفت کتاب">{checking?'در حال بررسی…':'بررسی دوباره'}<Icon name="replay"/></button></div>
    <div className="setup-progress-meter" role="progressbar" aria-label="پیشرفت کارهای اصلی کتاب" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}><i style={{width:`${progress.total?progress.completed/progress.total*100:0}%`}}/></div>
    <div className="setup-next-task" role="status">{nextIndex>=0?<><div><strong>کار بعدی: {stepLabels[nextIndex]}</strong><p>{saved[stepIds[nextIndex]]?.detail}</p></div><button type="button" onClick={showNext}>راهنمای این کار<Icon name="arrow"/></button></>:<div><strong>کارهای اصلی این کتاب ثبت شده‌اند.</strong><p>تصویر جلد اختصاصی و فهرست را هم در صورت نیاز تکمیل کن.</p></div>}</div>
   </>:<p className="setup-progress-loading" role="status">در حال بررسی اطلاعات ذخیره‌شدهٔ کتاب…</p>}
  </div>}
  <div id={region} hidden={!state.open} className="book-guide-body">
   {bookId&&progress&&<details ref={list} className="book-setup-checklist" open><summary>وضعیت همهٔ مراحل <span>{progress.steps.filter(step=>step.status!=='done'&&step.required).length.toLocaleString('fa-IR')} کار اصلی باقی مانده</span></summary><div className="setup-checklist-grid">{stepIds.map((id,index)=>{const step=saved[id];return <button type="button" key={id} aria-label={`${stepLabels[index]}، ${step?statusLabels[step.status]:'بررسی نشده'}`} aria-current={state.step===index?'step':undefined} onClick={()=>select(index)}>{icon(step,index)}<span><strong>{stepLabels[index]}</strong><small>{step?statusLabels[step.status]:'بررسی نشده'}{step&&!step.required&&step.status!=='optional'?' · اختیاری':''}</small></span></button>;})}</div><p>تیک‌ها از اطلاعات ثبت‌شدهٔ کتاب می‌آیند. متن و زیرنویس برای صفحه‌های غیرتصویری بررسی می‌شوند.</p></details>}
   <div className="book-guide-progress"><span>راهنمای گام {(state.step+1).toLocaleString('fa-IR')}</span><div aria-hidden="true">{steps.map((_,index)=><i key={index} className={`${saved[stepIds[index]]?.status==='done'?'saved-done ':''}${index===state.step?'current':''}`}/>)}</div><label><span className="sr-only">انتخاب مرحلهٔ راهنما</span><select aria-label="انتخاب مرحلهٔ راهنما" value={state.step} onChange={event=>select(Number(event.target.value))}>{steps.map((step,index)=><option key={step.title} value={index}>{saved[stepIds[index]]?.status==='done'?'✓ ':''}{(index+1).toLocaleString('fa-IR')}. {step.title}</option>)}</select></label></div>
   <div className="book-guide-step"><span className="book-guide-location">{current.location}</span><h3>{current.title}</h3>
    {currentSaved&&<div className={`setup-current-state state-${currentSaved.status}`}>{icon(currentSaved,state.step)}<div><strong>{statusLabels[currentSaved.status]}{!currentSaved.required&&currentSaved.status!=='optional'?' · اختیاری':''}</strong><p>{currentSaved.detail}</p></div></div>}
    {currentSaved&&currentSaved.pageNumbers.length>0&&onPage&&<div className="setup-missing-pages"><span>صفحه‌های نیازمند تکمیل:</span>{currentSaved.pageNumbers.map(number=><button type="button" key={number} onClick={()=>onPage(number)} aria-label={`تکمیل صفحهٔ ${number.toLocaleString('fa-IR')}`}>{number.toLocaleString('fa-IR')}</button>)}{currentSaved.remaining>currentSaved.pageNumbers.length&&<small>و {(currentSaved.remaining-currentSaved.pageNumbers.length).toLocaleString('fa-IR')} صفحهٔ دیگر</small>}</div>}
    {state.step===1&&<fieldset className="book-guide-text-choice"><legend>متن سالم کتاب را از قبل داری؟</legend><button type="button" aria-pressed={state.prepared} onClick={()=>setState(old=>({...old,prepared:true}))}>بله، متن آماده دارم</button><button type="button" aria-pressed={!state.prepared} onClick={()=>setState(old=>({...old,prepared:false}))}>متن را از PDF بگیر</button></fieldset>}
    {state.step===1&&hasPages&&<p className="book-guide-tip">صفحه‌های این کتاب از قبل وارد شده‌اند. برای ادامهٔ آماده‌سازی می‌توانی به مرحلهٔ جلد یا متن بروی؛ ورود دوبارهٔ PDF صفحه‌های تازه به کتاب اضافه می‌کند.</p>}
    {state.step===7&&bookId&&!hasPages&&<p className="book-guide-tip">برای پیش‌نمایش و انتشار، ابتدا مرحلهٔ «ورود PDF و صفحه‌ها» را تکمیل کن؛ هنوز صفحه‌ای در این کتاب ثبت نشده است.</p>}
    {state.step===3&&!state.prepared&&<p className="book-guide-tip">اگر متن استخراج‌شده در مرحلهٔ PDF درست است، می‌توانی از این مرحله عبور کنی. این بخش برای متن آماده یا اصلاح متن قبلی است.</p>}
    <ol>{instructions.map(text=><li key={text}>{readable(text)}</li>)}</ol>
    {state.step===3&&<div className="book-guide-example"><span>نمونهٔ شماره‌گذاری در فایل متن کامل</span><pre dir="ltr">{'=== Page 11 ===\nمتن صفحهٔ یازده…\n\n=== Page 12 ===\nمتن صفحهٔ دوازده…'}</pre></div>}
    {current.tip&&<p className="book-guide-tip">{readable(current.tip)}</p>}
   </div>
   <footer><div className="book-guide-actions"><button type="button" className="reader-button primary" onClick={action}>{bookId?current.action:'ساخت کتاب و شروع'}<Icon name="arrow"/></button>{state.step===7&&bookId&&hasPages&&firstPage&&<Link className="reader-button" to={`/read/${bookId}/${firstPage}`} target="_blank" rel="noopener noreferrer">پیش‌نمایش کتاب<Icon name="expand"/></Link>}</div><nav aria-label="جابه‌جایی بین مراحل راهنما"><button type="button" disabled={state.step===0} onClick={()=>select(state.step-1)}>مرحلهٔ قبل</button>{state.step<steps.length-1?<button type="button" onClick={()=>select(state.step+1)}>مرحلهٔ بعد<Icon name="chevron"/></button>:<button type="button" onClick={()=>setState(old=>({...old,open:false}))}>بستن راهنما</button>}</nav></footer>
  </div>
 </section>;
});
