import {CSSProperties,FormEvent,Ref,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Icon} from './Icon';
import {LibraryBook,LibraryPage} from '../types';
import {api,mediaUrl} from '../services/api';
import {chooseLibraryPreview} from '../utils/library';
import {useNarration} from '../hooks/useNarration';
import {useTheme} from '../hooks/useTheme';

const stories=[
  ['کتابی بردار، در واژه‌هایش قدم بزن،','به صدای قصه‌ها گوش بسپار','و در میان سطرها، جهان‌های تازه‌ای کشف کن.'],
  ['شاید یک کتاب، آغاز رؤیایی باشد','که مدت‌هاست در انتظار بیدار شدن است.'],
  ['کتاب‌ها تو را به دنیایی تازه دعوت می‌کنند.'],
];
function storedMotion(){try{return localStorage.getItem('bonbook_library_motion')!=='off';}catch{return true;}}
function time(value:number){return `${Math.floor(value/60).toLocaleString('fa-IR')}:${String(Math.floor(value%60)).padStart(2,'0').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)])}`;}

export interface LibraryHeroControls{listen:()=>void}
export function LibraryHero({book,resumeNumber,controls}:{book:LibraryBook|null;resumeNumber?:number;controls:Ref<LibraryHeroControls>}){
  const {theme}=useTheme(),audio=useNarration(),navigate=useNavigate();
  const [story,setStory]=useState(0),[query,setQuery]=useState(''),[opened,setOpened]=useState(false),[turned,setTurned]=useState(false),[tracking,setTracking]=useState(false);
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches),[moving,setMoving]=useState(storedMotion),[inView,setInView]=useState(true),[tabVisible,setTabVisible]=useState(!document.hidden);
  const [sample,setSample]=useState<LibraryPage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[insideImage,setInsideImage]=useState<string|null>(null);
  const art=useRef<HTMLDivElement>(null),request=useRef(0),mounted=useRef(true),started=useRef(false),stop=useRef(audio.stop),pointer=useRef<{x:number;y:number}|null>(null),dragged=useRef(false);
  const metadata=useRef(new Map<number,Promise<LibraryBook>>());stop.current=audio.stop;
  const motion=moving&&!reduced;
  const active=Boolean(book&&sample&&sample.bookId===book.id&&audio.target?.bookId===book.id&&audio.target.number===sample.number),playing=active&&audio.status==='playing';
  const sampleError=error||(active?audio.error:null),night=theme==='night';
  const motif=(variant=false)=>night?<>{variant?'✧':'✦'}</>:<Icon name="sun"/>;
  const getBook=(id:number)=>{
    let pending=metadata.current.get(id);if(!pending){pending=api.library.book(id).then(result=>result.book).catch(error=>{metadata.current.delete(id);throw error;});metadata.current.set(id,pending);}return pending;
  };
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;if(started.current)stop.current();};},[]);
  useEffect(()=>{request.current++;setSample(null);setLoading(false);setError('');setInsideImage(null);setOpened(false);setTurned(false);if(started.current){stop.current();started.current=false;}},[book?.id]);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{try{localStorage.setItem('bonbook_library_motion',moving?'on':'off');}catch{}},[moving]);
  useEffect(()=>{const target=art.current;if(!target)return;const observer=new IntersectionObserver(entries=>setInView(entries[0]?.isIntersecting??true),{threshold:.1});observer.observe(target);const visibility=()=>setTabVisible(!document.hidden);document.addEventListener('visibilitychange',visibility);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);};},[]);
  useEffect(()=>{const up=()=>{pointer.current=null;};window.addEventListener('pointerup',up);return()=>window.removeEventListener('pointerup',up);},[]);
  useEffect(()=>{
    let live=true;if(!opened||!book)return;
    void getBook(book.id).then(metadata=>{const first=metadata.pages?.[0];return first?api.library.page(book.id,first.number):null;}).then(result=>{if(live&&result?.page.visualMode!=='TEXT')setInsideImage(mediaUrl(result?.page.imageUrl||result?.page.sourceImageUrl||null));}).catch(()=>{if(live)setInsideImage(null);});
    return()=>{live=false;};
  },[opened,book?.id]);
  const resetTilt=()=>{setTracking(false);art.current?.style.setProperty('--tilt-x','0deg');art.current?.style.setProperty('--tilt-y','0deg');};
  const toggleBook=()=>{resetTilt();if(turned)setTurned(false);else setOpened(value=>!value);};
  const toggleAudio=async()=>{
    if(!book)return;
    if(loading){request.current++;setLoading(false);return;}
    if(active&&audio.status==='playing'){audio.pause();return;}
    if(active&&audio.status==='paused'){audio.resume();return;}
    const revision=++request.current;setError('');
    if(sample?.bookId===book.id&&sample.audioUrl){started.current=true;audio.play({bookId:book.id,number:sample.number,title:book.title,language:book.language,content:sample.content,audioUrl:mediaUrl(sample.audioUrl),audioCues:sample.audioCues,audioCueMode:sample.audioCueMode});return;}
    setLoading(true);
    try{
      const metadata=await getBook(book.id),chosen=chooseLibraryPreview(metadata.pages||[],resumeNumber);
      if(!chosen)throw new Error('برای این کتاب هنوز روایت صوتی بارگذاری نشده است؛ متن کتاب را باز کن.');
      const {page}=await api.library.page(book.id,chosen.number);
      if(!page.audioUrl)throw new Error('این روایت دیگر در دسترس نیست؛ کتاب را دوباره باز کن.');
      if(!mounted.current||revision!==request.current)return;
      setSample(page);started.current=true;
      audio.play({bookId:book.id,number:page.number,title:book.title,language:book.language,content:page.content,audioUrl:mediaUrl(page.audioUrl),audioCues:page.audioCues,audioCueMode:page.audioCueMode});
    }catch(error){metadata.current.delete(book.id);if(mounted.current&&revision===request.current)setError(error instanceof Error?error.message:'دریافت روایت انجام نشد؛ دوباره تلاش کن.');}
    finally{if(mounted.current&&revision===request.current)setLoading(false);}
  };
  const listen=()=>{void toggleAudio();art.current?.scrollIntoView({block:'center',behavior:motion?'smooth':'auto'});};
  useImperativeHandle(controls,()=>({listen}));
  const submit=(event:FormEvent)=>{event.preventDefault();if(query.trim())navigate('/search?q='+encodeURIComponent(query.trim()));};

  return <section className={`hero${!motion?' motion-paused':''}${!tabVisible?' tab-hidden':''}`} aria-labelledby="library-hero-title">
    <div className="hero-copy"><div className="eyebrow hero-kicker"><span className="status-star" aria-hidden="true">{motif()}</span> کمی از هیاهوی جهان فاصله بگیر <span className="kicker-rule"/></div>
      <h1 id="library-hero-title" aria-label="داستان بعدی زندگی‌ات را زندگی کن."><span className="title-line">داستان بعدی</span><span className="title-line">زندگی‌ات را</span><em className="title-line">زندگی کن<span className="title-period">.</span></em></h1>
      <p className="hero-intro">گاهی از هیاهوی جهان فاصله بگیر؛<br/>به خلوت خودت پناه ببر و پنجره‌ای تازه به روی روحت باز کن.</p>
      <div className="story-window"><div className="story-content" key={story} aria-live="off">{stories[story].map((line,lineIndex)=><p key={lineIndex}>{line.split(' ').map((word,index)=><span key={index}><span className="story-word" style={{'--word-delay':`${(stories[story].slice(0,lineIndex).join(' ').split(' ').filter(Boolean).length+index)*.055}s`} as CSSProperties}>{word}</span>{' '}</span>)}</p>)}</div><div className="story-controls"><div className="story-dots" role="group" aria-label="جمله‌های الهام‌بخش">{['قدم‌زدن در واژه‌ها','آغاز رؤیا','دعوت به دنیایی تازه'].map((label,index)=><button type="button" key={label} className={story===index?'active':''} aria-label={label} aria-pressed={story===index} onClick={()=>setStory(index)}><span/></button>)}</div><button className="story-next" onClick={()=>setStory((story+1)%stories.length)}>جملهٔ بعد <Icon name="arrow"/></button></div></div>
      <form className="search-box" role="search" onSubmit={submit}><Icon name="search"/><input aria-label="جست‌وجو در متن کتاب‌ها" value={query} onChange={e=>setQuery(e.target.value)} placeholder="امروز، دلت چه جهانی می‌خواهد؟"/><button type="submit" aria-label="پیدا کردن موضوع در کتاب‌ها"><Icon name="arrow"/></button></form><div className="hero-search-caption"><span>بین واژه‌ها، خودت را پیدا کن.</span><a href="#library-shelf" onClick={event=>{event.preventDefault();document.getElementById('library-shelf')?.scrollIntoView({behavior:motion?'smooth':'auto'});}}>دیدن کتابخانه <Icon name="chevron"/></a></div>
    </div>
    <div ref={art} className={`hero-art${tracking?' is-tracking':''}${!inView?' out-of-view':''}`} aria-label="کتاب سه‌بعدی تعاملی"><div className="orbit orbit-outer" aria-hidden="true"/><div className="orbit orbit-inner" aria-hidden="true"/><span className="orbit-star star-a" aria-hidden="true">{motif()}</span><span className="orbit-star star-b" aria-hidden="true">{motif(true)}</span><div className="art-caption" dir="ltr">A LITTLE SPACE FOR YOURSELF</div>
      <div className="book-scene" onPointerDown={event=>{if(event.button===0){pointer.current={x:event.clientX,y:event.clientY};dragged.current=false;}}} onPointerMove={event=>{if(opened||!motion||event.pointerType==='touch'&&!pointer.current)return;const box=event.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y=Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));setTracking(true);art.current?.style.setProperty('--tilt-x',`${(.5-y)*12}deg`);art.current?.style.setProperty('--tilt-y',`${(x-.5)*22}deg`);art.current?.style.setProperty('--light-x',`${x*100}%`);art.current?.style.setProperty('--light-y',`${y*100}%`);if(pointer.current&&Math.hypot(event.clientX-pointer.current.x,event.clientY-pointer.current.y)>9)dragged.current=true;}} onPointerLeave={()=>{resetTilt();pointer.current=null;}} onPointerCancel={()=>{resetTilt();pointer.current=null;}}>
        <div className="book-shadow" aria-hidden="true"/><div className={`book-model${opened?' is-open':''}${turned?' is-turned':''}`}>
          <div className="book-back" dir="rtl" aria-hidden={!turned}><span dir="ltr">BONBOOK</span><i>{motif()}</i><p>کتاب‌ها تو را<br/>به دنیایی تازه<br/>دعوت می‌کنند.</p><small>بخوان. بشنو. کشف کن.</small></div><div className="book-spine" aria-hidden="true"><span>یک فصل برای خودت</span><b dir="ltr">B</b></div><div className="book-pages" aria-hidden="true"/><div className="book-pages-top" aria-hidden="true"/><div className="book-pages-bottom" aria-hidden="true"/>
          <div className="book-inside" aria-hidden={!opened}>{insideImage?<img src={insideImage} alt={`صفحهٔ آغاز ${book?.title||'کتاب'}`} onError={()=>setInsideImage(null)}/>:<div className="inside-invitation"><Icon name="book"/><p>یک کتاب،<br/>یک شروع تازه.</p></div>}<span>آغازِ یک جهان تازه</span></div>
          <button className="book-front" type="button" aria-label={turned?'نمایش روی جلد کتاب سه‌بعدی':opened?'بستن جلد کتاب سه‌بعدی':'باز کردن جلد کتاب سه‌بعدی'} aria-expanded={opened} onClick={()=>{if(dragged.current){dragged.current=false;return;}toggleBook();}} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();resetTilt();setOpened(false);setTurned(!turned);}else if(event.key==='Escape'){setOpened(false);setTurned(false);resetTilt();}}}><span className="front-face" aria-hidden={opened||turned}><span className="cover-top"><span dir="ltr">BONBOOK</span><span className="cover-edition">فصل تازهٔ تو</span></span><span className="cover-title">یک فصل<br/>برای خودت</span><span className="cover-moon" aria-hidden="true"><i/><b>{motif()}</b></span><span className="cover-subtitle">بخوان. بشنو. کشف کن.</span><span className="cover-rule"/><span className="cover-bottom" dir="ltr">EVERY BOOK, A NEW BEGINNING.</span></span><span className="inner-cover" aria-hidden="true"><span>یک کتاب،<br/>یک شروع تازه.</span><i>{motif()}</i></span></button>
        </div>
      </div>
      <div className="book-actions"><button type="button" className="lc-book-hint" aria-label="ورق زدن کتاب سه‌بعدی" aria-expanded={opened} onClick={toggleBook}><i/>{turned?'پشتِ یک جهان تازه':opened?'دوباره لمس کن تا بسته شود':'جلد را لمس کن'}</button><button type="button" aria-label={turned?'نمایش روی کتاب سه‌بعدی':'نمایش پشت کتاب سه‌بعدی'} onClick={()=>{setOpened(false);setTurned(!turned);resetTilt();}}><Icon name="replay"/>{turned?'روی جلد':'بچرخان'}</button><button type="button" className="lc-motion-toggle" aria-pressed={!motion} disabled={reduced} aria-label={reduced?'حرکت‌ها طبق تنظیم مرورگر متوقف‌اند':motion?'توقف حرکت‌ها':'فعال‌کردن حرکت‌ها'} onClick={()=>{setMoving(!moving);resetTilt();}}><Icon name={motion?'pause':'play'}/></button></div>
      <button type="button" className={`audio-note${playing?' is-playing':''}`} disabled={!book} aria-label={loading?'لغو دریافت روایت':playing?'مکث روایت کتاب':active&&audio.status==='paused'?'ادامهٔ روایت کتاب':'پخش نمونهٔ روایت واقعی کتاب'} aria-pressed={playing} onClick={()=>void toggleAudio()}><span className="audio-note-icon"><Icon name={playing?'pause':'headphones'}/></span><span className="audio-note-copy"><b>{loading?'در حال آماده‌کردن روایت…':playing?'دارم برایت روایت می‌کنم…':'کتاب‌ها صدایت می‌زنند'}</b><small>{active&&audio.elapsedSeconds>0?`روایت اصلی کتاب · ${time(audio.elapsedSeconds)}`:'کمی به قصه‌ها گوش بسپار'}</small></span><span className="waveform" aria-hidden="true">{Array.from({length:11},(_,i)=><i key={i} style={{'--bar':i} as CSSProperties}/>)}</span><span className="audio-progress" aria-hidden="true"><i style={{width:`${active?audio.position:0}%`}}/></span></button>
      {sampleError&&<p className="lc-audio-error" role="alert">{sampleError}</p>}
    </div><div className="hero-bottom-rule" aria-hidden="true"><span/><Icon name={night?'plus':'sun'}/><span/></div>
  </section>;
}
