import {useEffect,useRef,useState} from 'react';
import {Link,useLocation,useNavigate,useParams} from 'react-router-dom';
import {Icon} from '../components/Icon';
import {BookCover} from '../components/BookCover';
import {ReadAlongText} from '../components/ReadAlongText';
import {ReaderBook,readerPageImage} from '../components/ReaderBook';
import {api,mediaUrl} from '../services/api';
import {LibraryBook,LibraryPage} from '../types';
import {useAuth} from '../hooks/useAuth';
import {recordedPages} from '../utils/bookAudioQueue';
import {useNarration} from '../hooks/useNarration';
import {useTheme} from '../hooks/useTheme';
import {useSiteFeatures} from '../hooks/useSiteFeatures';
import {ReaderPlayback,ReaderPlaybackState} from '../components/ReaderPlayback';
import {ReaderImmersive} from '../components/ReaderImmersive';
import {resumeDevicePage,saveDeviceReading} from '../utils/readingProgress';

function preference(key:string,fallback:string){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function remember(key:string,value:string){try{localStorage.setItem(key,value);}catch{/* Reading works without browser storage. */}}
const fa=(value:number)=>value.toLocaleString('fa-IR');

export function Reader(){
  const {canAccess}=useSiteFeatures();
  const params=useParams(),bookId=Number(params.bookId),number=Number(params.page),navigate=useNavigate(),location=useLocation();
  const [book,setBook]=useState<LibraryBook|null>(null),[loadedPage,setPage]=useState<LibraryPage|null>(null),[facing,setFacing]=useState<LibraryPage|null>(null);
  const {theme:siteTheme,setTheme:setSiteTheme}=useTheme(),theme=siteTheme==='night'?'night':'paper';
  const setTheme=(value:string)=>setSiteTheme(value==='night'?'night':'day');
  const [view,setView]=useState(()=>preference('bonbook_reader_view','spread')==='single'?'single':'spread');
  const [fontSize,setFontSize]=useState(17),[error,setError]=useState(''),[follow,setFollow]=useState(true),[toc,setToc]=useState(false),[tocMode,setTocMode]=useState<'contents'|'pages'>('contents');
  const [captions,setCaptions]=useState(true),[zoom,setZoom]=useState(false),[bookmark,setBookmark]=useState<number|null>(null);
  const [autoSave,setAutoSave]=useState(()=>preference('bonbook_reader_auto_resume','on')!=='off'),[continuous,setContinuous]=useState(()=>preference('bonbook_reader_continuous','on')!=='off'),[zoomSingle,setZoomSingle]=useState(false);
  const [wide,setWide]=useState(()=>window.matchMedia('(min-width: 521px)').matches);
  const {user}=useAuth(),audio=useNarration(),terms=(location.state as {highlight?:string[]}|null)?.highlight||[];
  const stopAudio=useRef(audio.stop),touch=useRef<{x:number;y:number}|null>(null),swiped=useRef(0);stopAudio.current=audio.stop;
  useEffect(()=>()=>stopAudio.current(),[bookId]);
  useEffect(()=>{const media=window.matchMedia('(min-width: 521px)'),change=()=>setWide(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{document.body.classList.add('bonbook-reading');return()=>document.body.classList.remove('bonbook-reading','bonbook-reading-night');},[]);
  useEffect(()=>{document.body.classList.toggle('bonbook-reading-night',theme==='night');},[theme]);
  useEffect(()=>{remember('bonbook_reader_view',view);},[view]);
  useEffect(()=>{remember('bonbook_reader_auto_resume',autoSave?'on':'off');},[autoSave]);
  useEffect(()=>{remember('bonbook_reader_continuous',continuous?'on':'off');},[continuous]);
  useEffect(()=>{setBookmark(Number(preference(`bonbook_bookmark_${bookId}`,''))||null);},[bookId]);
  useEffect(()=>{if(terms.length)setCaptions(false);},[location.key]);
  useEffect(()=>{let live=true;setError('');setBook(null);setPage(null);setFacing(null);void api.library.book(bookId).then(result=>{if(live)setBook(result.book);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[bookId]);
  useEffect(()=>{
    if(!book||book.id!==bookId)return;let live=true;setError('');
    if(number===0){const target=resumeDevicePage(bookId,book.pages||[]);if(target)navigate(`/read/${bookId}/${target}`,{replace:true});else setError('این کتاب هنوز صفحه‌ای ندارد.');return;}
    const cached=audio.mode==='book'&&audio.target?.bookId===bookId&&audio.target.number===number?audio.target.page:null;
    if(cached)setPage(cached);
    void (cached?Promise.resolve({page:cached}):api.library.page(bookId,number)).then(response=>{if(live){setPage(response.page);}}).catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[book,bookId,number,navigate,user?.id]);
  useEffect(()=>{if(audio.mode==='book'&&!audio.playlist?.completed&&audio.target?.bookId===bookId&&audio.target.number!==number){setToc(false);navigate(`/read/${bookId}/${audio.target.number}`,{replace:true});}},[audio.mode,audio.playlist?.completed,audio.target?.bookId,audio.target?.number,bookId,number,navigate]);
  useEffect(()=>{setZoom(false);},[bookId]);
  const page=audio.mode==='book'&&audio.target?.bookId===bookId&&audio.target.number===number&&audio.target.page?audio.target.page:loadedPage?.bookId===bookId&&loadedPage.number===number?loadedPage:null;
  useEffect(()=>{if(!autoSave||!page||page.bookId!==bookId||page.number!==number)return;saveDeviceReading({bookId,pageNumber:number,title:book?.title||'',heading:page.heading,updatedAt:Date.now()});setBookmark(number);if(user)void api.library.saveProgress(bookId,number).catch(()=>{});},[autoSave,page?.bookId,page?.number,bookId,number,book?.title,user?.id]);
  const visualPage=page||(loadedPage?.bookId===bookId?loadedPage:null),index=book?.pages?.findIndex(p=>p.number===number)??-1,physicalNext=book?.pages?.[index+1]?.number;
  useEffect(()=>{let live=true;setFacing(null);if(!book||(zoom?zoomSingle:!wide||view==='single')||physicalNext===undefined)return;void api.library.page(book.id,physicalNext).then(result=>{if(live)setFacing(result.page);}).catch(()=>{});return()=>{live=false;};},[book?.id,physicalNext,view,wide,zoom,zoomSingle]);
  const shownFacing=facing?.bookId===bookId&&facing.number===physicalNext?facing:null;
  const active=audio.target?.bookId===bookId&&audio.target.number===number,session=audio.playlist?.bookId===bookId?audio.playlist:null;
  const fullBook=audio.mode==='book'&&Boolean(session&&!session.completed),voices=recordedPages(book?.pages||[]),voiceIndex=voices.indexOf(number),voicePosition=voiceIndex<0?session?.index||0:voiceIndex;
  const previous=fullBook?voices[voicePosition-1]:book?.pages?.[index-1]?.number,next=fullBook?voices[voicePosition+1]:physicalNext;
  const playing=(active||fullBook)&&audio.status==='playing',loading=fullBook&&audio.status==='loading';
  const go=(target:number)=>{setToc(false);if(fullBook&&voices.some(voice=>voice>=target)){audio.jumpBook(target);return;}audio.stop();navigate(`/read/${bookId}/${target}`);};
  const goRef=useRef(go);goRef.current=go;
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||zoom||(event.target as HTMLElement)?.closest('input,select,textarea,button,a,[contenteditable="true"]'))return;const target=event.key==='ArrowLeft'?next:event.key==='ArrowRight'?previous:undefined;if(target!==undefined){event.preventDefault();goRef.current(target);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[previous,next,zoom]);
  const replay=()=>{if(book){setContinuous(true);audio.playBook(book);}};
  const play=()=>{if(fullBook){if(audio.status==='playing'||audio.status==='loading')audio.pause();else audio.resume();return;}if(!page||!book)return;if(active&&audio.status==='playing')audio.pause();else if(active&&audio.status==='paused')audio.resume();else if(continuous&&voices.length){if(session?.completed)replay();else audio.playBook(book,number,page);}else audio.play({bookId,number,title:book.title,content:page.content,language:book.language,audioUrl:mediaUrl(page.audioUrl),audioCues:page.audioCues,audioCueMode:page.audioCueMode});};
  const toggleContinuous=()=>{const next=!continuous;setContinuous(next);if(fullBook)audio.stop();else if(next&&active&&audio.status==='playing'&&book)audio.playBook(book,number,page||undefined);};
  const openZoom=()=>{if(Date.now()-swiped.current>500&&page){setZoomSingle(view==='single'||!wide);setZoom(true);}};
  const toggleBookmark=()=>setAutoSave(value=>!value);
  const chapter=book?.contents?.reduce((best,item)=>item.pageNumber<=number&&(!best||item.pageNumber>=best.pageNumber)?item:best,null as NonNullable<LibraryBook['contents']>[number]|null);
  const heading=page?.heading||chapter?.title||`صفحهٔ ${fa(number)}`,offset=active&&audio.status!=='idle'?audio.offset:-1;
  const useCaptions=captions&&Boolean(page?.content)&&page?.visualMode!=='IMAGE',nextVoice=voices.find(n=>n>number),previousVoice=[...voices].reverse().find(n=>n<number);
  const audioMove=(direction:1|-1)=>{if(fullBook){if(direction>0)audio.nextBook();else audio.previousBook();}else{const target=direction>0?nextVoice:previousVoice;if(target!==undefined)go(target);}};

  const playback:ReaderPlaybackState|null=book?{book,page,number,heading,audio,active,fullBook,continuous,completed:Boolean(session?.completed),playing,loading,voices,voicePosition,previousVoice,nextVoice,play,move:audioMove,toggleContinuous,replay}:null;
  const isAdmin=user?.role==='OWNER'||user?.role==='ADMIN';
  return <div className={`reading-experience rx-${theme}${playing?' rx-playing':''}`}>
    <header className="rx-header"><Link className="rx-brand" to="/library" aria-label="BonBook، کتابخانه"><span className="rx-brand-mark"><Icon name="book"/></span><span><b dir="ltr">BonBook</b><small>کتابخانهٔ شنیداری</small></span></Link><nav className="rx-main-nav" aria-label="ناوبری کتاب‌خوان"><Link to="/library">کتابخانه</Link><span aria-current="page">کتاب‌خوانی</span>{canAccess('search')&&<Link to={`/search?bookId=${bookId}`}>جست‌وجو</Link>}{canAccess('store')&&<Link to="/shop">فروشگاه</Link>}{(user?.role==='ADMIN'||user?.role==='OWNER')&&<Link to="/admin">مدیریت</Link>}</nav>{(!user||canAccess('profile'))&&<Link className="rx-account" to={user?'/profile':'/login'} aria-label={user?'حساب کاربری':'ورود'}><Icon name="user"/></Link>}</header>
    {!book?<div className="rx-initial" role={error?'alert':'status'}>{error||'در حال آماده‌کردن کتاب…'}<Link to="/library">بازگشت به کتابخانه</Link></div>:<main className="rx-shell" id="main-content">
      {toc&&<button className="rx-sidebar-backdrop" aria-label="بستن فهرست" onClick={()=>setToc(false)}/>}
      <aside className={`rx-sidebar${toc?' rx-sidebar-open':''}`} aria-label="اطلاعات و فهرست کتاب"><button className="rx-icon-button rx-sidebar-close" aria-label="بستن فهرست کتاب" onClick={()=>setToc(false)}><Icon name="close"/></button>
        <div className="rx-sidebar-book"><div className="rx-cover-mini"><BookCover book={book} small/></div><div><span className="rx-eyebrow">در حال مطالعه</span><h2>{book.title}</h2><p>{book.author}</p></div></div>
        <div className="rx-sidebar-divider"/><div className="rx-contents-heading"><h3><Icon name="orders"/> فهرست کتاب</h3><span>صفحه</span></div>
        <div className="rx-contents-tabs"><button className={tocMode==='contents'?'active':''} onClick={()=>setTocMode('contents')}>فهرست مطالب</button><button className={tocMode==='pages'?'active':''} onClick={()=>setTocMode('pages')}>همهٔ صفحه‌ها</button></div>
        <nav className="rx-contents" aria-label="فهرست کتاب">{tocMode==='contents'&&book.contents?.length?book.contents.map((item,i)=><button key={i} style={{paddingInlineStart:13+item.level*14}} className={chapter===item?'active':''} aria-current={chapter===item?'location':undefined} onClick={()=>go(item.pageNumber)}><span>{item.title}</span><span>{fa(item.pageNumber)}</span></button>):tocMode==='contents'?<p className="rx-contents-empty">فهرست فصل‌ها هنوز ثبت نشده است.<button onClick={()=>setTocMode('pages')}>دیدن همهٔ صفحه‌ها</button></p>:book.pages?.map(item=><button className={item.number===number?'active':''} aria-current={item.number===number?'page':undefined} key={item.number} onClick={()=>go(item.number)}><span>{item.heading||'بدون عنوان'}</span><span>{fa(item.number)}</span>{item.hasAudio&&<Icon name="headphones"/>}</button>)}</nav>
        {bookmark&&bookmark!==number&&<button className="rx-saved-page" onClick={()=>go(bookmark)}><Icon name="bookmark"/>رفتن به نشان صفحهٔ {fa(bookmark)}</button>}
        <div className="rx-sidebar-bottom"><Icon name="headphones"/><div><b>خواندن با چشم، شنیدن با دل</b><p>{voices.length?`${fa(voices.length)} روایت صوتی همراهِ کتاب`:'متن و تصویرهای کتاب'}</p></div></div>
      </aside>
      <section className="rx-reading-area" aria-label="فضای کتاب‌خوانی">
        <div className="rx-reading-heading"><div><span className="rx-eyebrow">کتاب‌خوانی{book.category?' / '+book.category:''}</span><h1>{book.title}</h1></div><button className="rx-icon-button rx-mobile-contents" onClick={()=>setToc(!toc)} aria-label="فهرست کتاب" aria-expanded={toc}><Icon name="orders"/></button><button className="rx-icon-button rx-auto-resume" onClick={toggleBookmark} aria-label="ذخیرهٔ خودکار آخرین صفحه" title={autoSave?'آخرین صفحه روی این دستگاه ذخیره می‌شود':'فعال‌کردن ذخیرهٔ خودکار روی این دستگاه'} aria-pressed={autoSave}><Icon name="bookmark"/></button></div>
        <div className="rx-toolbar"><div className="rx-view-switch" role="group" aria-label="شیوهٔ نمایش"><button className={view==='spread'?'active':''} aria-pressed={view==='spread'} onClick={()=>setView('spread')}><Icon name="book"/>نمای کتاب</button><button className={view==='single'?'active':''} aria-pressed={view==='single'} onClick={()=>setView('single')}>تک‌صفحه</button></div><span className="rx-chapter-label">{chapter?.title||heading}</span><div className="rx-tools">{canAccess('search')&&<Link className="rx-icon-button" to={`/search?bookId=${bookId}`} aria-label="جست‌وجو در این کتاب"><Icon name="search"/></Link>}<button className="rx-icon-button" aria-label={theme==='night'?'حالت روز':'حالت شب آبی مهتابی'} aria-pressed={theme==='night'} onClick={()=>setTheme(theme==='night'?'paper':'night')}><Icon name={theme==='night'?'sun':'moon'}/></button><button className="rx-icon-button" onClick={openZoom} disabled={!page} aria-label="تصویر کامل کتاب"><Icon name="expand"/></button></div></div>
        {error&&<p className="rx-notice" role="alert">{error}</p>}
        <div className="rx-desk" aria-busy={!page} onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>60&&Math.abs(dy)<65){const target=dx<0?next:previous;if(target!==undefined){swiped.current=Date.now();go(target);}}}}>
          <span className="rx-desk-ornament" aria-hidden="true">B</span><button className="rx-page-arrow rx-previous" disabled={previous===undefined} onClick={()=>previous!==undefined&&go(previous)} aria-label={fullBook?'ویس قبلی کتاب':'ورق به صفحهٔ قبل'}><Icon name="chevron" className="rx-flipped"/></button>
          {visualPage?<ReaderBook page={visualPage} facing={shownFacing} hasFacing={physicalNext!==undefined} title={book.title} single={view==='single'||!wide} onZoom={openZoom} onFacing={()=>physicalNext!==undefined&&go(physicalNext)}/>:null}
          {!page&&!error&&<div className="rx-page-loading" role="status">در حال ورق‌زدن…</div>}
          <button className="rx-page-arrow rx-next" disabled={next===undefined} onClick={()=>next!==undefined&&go(next)} aria-label={fullBook?'ویس بعدی کتاب':'ورق به صفحهٔ بعد'}><Icon name="chevron"/></button>
        </div>
        <div className="rx-page-footer"><span className="rx-original-label"><i/>{page&&readerPageImage(page)?'تصویر اصلی کتاب':'متن کتاب'}{isAdmin&&page?.sourceUrl&&<a href={page.sourceUrl+(page.sourcePageNumber?'#page='+page.sourcePageNumber:'')} target="_blank" rel="noopener noreferrer">فایل اصلی ↗</a>}</span><label className="rx-page-counter">صفحهٔ <select value={number} aria-label="انتخاب صفحهٔ کتاب" onChange={e=>go(Number(e.target.value))}>{book.pages?.map(item=><option key={item.number} value={item.number}>{fa(item.number)}</option>)}</select><span>از {fa(book.pageCount)}</span></label><span className="rx-keyboard-tip">با کلیدهای ← → ورق بزن</span></div>
        <section className="rx-transcript-card" aria-label="متن همراه با صدا"><div className="rx-transcript-top"><div className="rx-transcript-heading"><h2><span className="rx-sound-wave" aria-hidden="true"><i/><i/><i/><i/></span>متن همراهِ صدا</h2>{page?.content&&page.visualMode!=='IMAGE'&&<button className="rx-caption-button" aria-pressed={captions} onClick={()=>setCaptions(!captions)}>{captions?'نمایش متن کامل':'نمایش زیرنویس'}</button>}</div><label className="rx-follow-label"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/><span/>دنبال‌کردن خودکار</label></div>
          <div className="rx-transcript-body" style={{fontSize}}>{!page?<p className="rx-transcript-empty">در حال دریافت صفحه…</p>:page.visualMode==='IMAGE'?<p className="rx-transcript-empty">{page.audioUrl?'این صفحه تصویری است؛ روایت صوتی آن را می‌توانی پخش کنی.':'این صفحه تصویری است؛ تصویر اصلی کتاب را ببین.'}</p>:page.content?<ReadAlongText key={`${bookId}-${number}`} text={page.content} offset={offset} follow={follow} terms={terms} captions={useCaptions} contained/>:<p className="rx-transcript-empty">این صفحه متن قابل خواندن ندارد؛ تصویر اصلی کتاب را ببین.</p>}</div>
          <div className="rx-transcript-foot"><span>{active&&audio.approximate?'همراهی این روایت با متن تقریبی است.':fullBook?`ویس ${fa(voicePosition+1)} از ${fa(voices.length)}؛ صفحه‌های بدون ویس رد می‌شوند.`:session?.completed?'پخش همهٔ ویس‌های کتاب به پایان رسید.':'با پخش روایت، جملهٔ در حال خواندن روشن می‌شود.'}</span><button onClick={()=>setFontSize(fontSize>=23?17:fontSize+2)} aria-label="بزرگ‌تر کردن متن همراه">آ +</button></div>
        </section>
      </section>
    </main>}
    {!zoom&&playback&&<footer className="rx-player" aria-label="پخش‌کنندهٔ روایت کتاب"><ReaderPlayback state={playback}/></footer>}
    <ReaderImmersive open={zoom} onClose={()=>setZoom(false)} book={book} page={page} visualPage={visualPage} facing={shownFacing} hasFacing={physicalNext!==undefined} number={number} heading={heading} night={theme==='night'} onTheme={()=>setTheme(theme==='night'?'paper':'night')} single={zoomSingle} onSingle={()=>setZoomSingle(value=>!value)} previous={previous} next={next} onGo={go} onFacing={()=>physicalNext!==undefined&&go(physicalNext)} offset={offset} terms={terms} playback={playback}/>

  </div>;
}



