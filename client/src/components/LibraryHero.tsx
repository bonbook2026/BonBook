import {CSSProperties,FormEvent,Ref,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Icon} from './Icon';
import {LibraryBook} from '../types';
import {api,mediaUrl} from '../services/api';
import {chooseLibraryPreview} from '../utils/library';
import {useNarration,NarrationTarget} from '../hooks/useNarration';
import {LibraryHeroSettings,defaultLibraryHero} from '../types/siteSettings';
import {useSiteFeatures} from '../hooks/useSiteFeatures';
import {useTheme} from '../hooks/useTheme';
import {useAuth} from '../hooks/useAuth';

function storedMotion(){try{return localStorage.getItem('bonbook_library_motion')!=='off';}catch{return true;}}
function time(value:number){return `${Math.floor(value/60).toLocaleString('fa-IR')}:${String(Math.floor(value%60)).padStart(2,'0').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)])}`;}

export interface LibraryHeroControls{listen:()=>void}
export function LibraryHero({book,resumeNumber,controls,config=defaultLibraryHero}:{book:LibraryBook|null;resumeNumber?:number;controls:Ref<LibraryHeroControls>;config?:LibraryHeroSettings}){
  const {canAccess}=useSiteFeatures();
  const {user}=useAuth();
  const {theme}=useTheme(),audio=useNarration(),navigate=useNavigate();
  const [story,setStory]=useState(0),[query,setQuery]=useState(''),[opened,setOpened]=useState(false),[turned,setTurned]=useState(false),[tracking,setTracking]=useState(false);
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches),[moving,setMoving]=useState(storedMotion),[inView,setInView]=useState(true),[tabVisible,setTabVisible]=useState(!document.hidden);
  const [sample,setSample]=useState<NarrationTarget|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[insideImage,setInsideImage]=useState<string|null>(null);
  const art=useRef<HTMLDivElement>(null),request=useRef(0),mounted=useRef(true),started=useRef(false),stop=useRef(audio.stop),pointer=useRef<{x:number;y:number}|null>(null),dragged=useRef(false);
  const metadata=useRef(new Map<number,Promise<LibraryBook>>());stop.current=audio.stop;
  const motion=moving&&!reduced&&config.motionEnabled,stories=config.stories,currentStory=stories[story]||stories[0];
  const [failedImages,setFailedImages]=useState<string[]>([]);
  const heroImage=(id:string|null)=>id&&!failedImages.includes(id)?mediaUrl(`/api/media/${id}`):null;
  const failImage=(id:string|null)=>{if(id)setFailedImages(current=>[...new Set([...current,id])]);};
  const frontImage=heroImage(config.frontImageAssetId),backImage=heroImage(config.backImageAssetId),inside=heroImage(config.insideImageAssetId)||insideImage;
  const canListen=config.audioMode!=='OFF'&&(config.audioMode==='UPLOAD'?Boolean(config.audioAssetId):config.audioMode==='PAGE'?Boolean(config.audioBookId&&config.audioPageNumber):Boolean(book));
  const active=Boolean(sample&&audio.target?.bookId===sample.bookId&&audio.target.number===sample.number&&audio.target.audioUrl===sample.audioUrl),playing=active&&audio.status==='playing';
  const sampleError=error||(active?audio.error:null),night=theme==='night';
  const motif=(variant=false)=>night?<>{variant?'✧':'✦'}</>:<Icon name="sun"/>;
  const getBook=(id:number)=>{
    let pending=metadata.current.get(id);if(!pending){pending=api.library.book(id).then(result=>result.book).catch(error=>{metadata.current.delete(id);throw error;});metadata.current.set(id,pending);}return pending;
  };
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;if(started.current)stop.current();};},[]);
  useEffect(()=>{request.current++;setSample(null);setLoading(false);setError('');setInsideImage(null);setOpened(false);setTurned(false);if(started.current){stop.current();started.current=false;}},[book?.id,config.audioMode,config.audioBookId,config.audioPageNumber,config.audioAssetId]);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{try{localStorage.setItem('bonbook_library_motion',moving?'on':'off');}catch{}},[moving]);
  useEffect(()=>{const target=art.current;if(!target)return;const observer=new IntersectionObserver(entries=>setInView(entries[0]?.isIntersecting??true),{threshold:.1});observer.observe(target);const visibility=()=>setTabVisible(!document.hidden);document.addEventListener('visibilitychange',visibility);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);};},[]);
  useEffect(()=>{const up=()=>{pointer.current=null;};window.addEventListener('pointerup',up);return()=>window.removeEventListener('pointerup',up);},[]);
  useEffect(()=>{
    let live=true;if(!user||!opened||!book||config.insideImageAssetId)return;
    void getBook(book.id).then(metadata=>{const first=metadata.pages?.[0];return first?api.library.page(book.id,first.number):null;}).then(result=>{if(live&&result?.page.visualMode!=='TEXT')setInsideImage(mediaUrl(result?.page.imageUrl||result?.page.sourceImageUrl||null));}).catch(()=>{if(live)setInsideImage(null);});
    return()=>{live=false;};
  },[opened,book?.id,config.insideImageAssetId,user?.id]);
  const resetTilt=()=>{setTracking(false);art.current?.style.setProperty('--tilt-x','0deg');art.current?.style.setProperty('--tilt-y','0deg');};
  const toggleBook=()=>{resetTilt();if(turned)setTurned(false);else setOpened(value=>!value);};
  const toggleAudio=async()=>{
    if(!canListen)return;
    if(!user){navigate('/login',{state:{next:'/library'}});return;}
    if(loading){request.current++;setLoading(false);return;}
    if(active&&audio.status==='playing'){audio.pause();return;}
    if(active&&audio.status==='paused'){audio.resume();return;}
    const revision=++request.current;setError('');setLoading(true);
    try{
      let target=sample;
      if(!target){
        if(config.audioMode==='UPLOAD')target={bookId:0,number:0,title:config.audioTitle,language:'fa-IR',content:'',audioUrl:mediaUrl((await api.site.heroAudio()).url)};
        else{
          const metadata=await getBook(config.audioMode==='PAGE'?config.audioBookId!:book!.id);
          const chosen=config.audioMode==='PAGE'?metadata.pages?.find(page=>page.number===config.audioPageNumber&&page.hasAudio):chooseLibraryPreview(metadata.pages||[],resumeNumber);
          if(!chosen)throw new Error('برای این بخش هنوز ویس قابل پخشی انتخاب نشده است.');
          const {page}=await api.library.page(metadata.id,chosen.number);
          if(!page.audioUrl)throw new Error('این روایت دیگر در دسترس نیست؛ کتاب را دوباره باز کن.');
          target={bookId:metadata.id,number:page.number,title:metadata.title,language:metadata.language,content:page.content,audioUrl:mediaUrl(page.audioUrl),audioCues:page.audioCues,audioCueMode:page.audioCueMode};
        }
      }
      if(!mounted.current||revision!==request.current)return;
      setSample(target);started.current=true;audio.play(target);
    }catch(error){metadata.current.clear();if(mounted.current&&revision===request.current)setError(error instanceof Error?error.message:'دریافت روایت انجام نشد؛ دوباره تلاش کن.');}
    finally{if(mounted.current&&revision===request.current)setLoading(false);}
  };
  const listen=()=>{void toggleAudio();art.current?.scrollIntoView({block:'center',behavior:motion?'smooth':'auto'});};
  useImperativeHandle(controls,()=>({listen}));
  const submit=(event:FormEvent)=>{event.preventDefault();if(query.trim())navigate('/search?q='+encodeURIComponent(query.trim()));};

  return <section className={`hero${!config.bookVisible?' without-book':''}${!motion?' motion-paused':''}${!tabVisible?' tab-hidden':''}`} aria-labelledby="library-hero-title">
    <div className="hero-copy"><div className="eyebrow hero-kicker"><span className="status-star" aria-hidden="true">{motif()}</span> {config.kicker} <span className="kicker-rule"/></div>
      <h1 id="library-hero-title" aria-label={config.titleLines.join(' ')}>{config.titleLines.map((line,index)=>index===2?<em key={index} className="title-line">{line}{!/[.؟!]$/.test(line)&&<span className="title-period">.</span>}</em>:<span key={index} className="title-line">{line}</span>)}</h1>
      <p className="hero-intro">{config.intro}</p>
      <div className="story-window"><div className="story-content" key={story} aria-live="off">{currentStory.map((line,lineIndex)=><p key={lineIndex}>{line.split(' ').map((word,index)=><span key={index}><span className="story-word" style={{'--word-delay':`${(currentStory.slice(0,lineIndex).join(' ').split(' ').filter(Boolean).length+index)*.055}s`} as CSSProperties}>{word}</span>{' '}</span>)}</p>)}</div><div className="story-controls"><div className="story-dots" role="group" aria-label="جمله‌های الهام‌بخش">{stories.map((lines,index)=><button type="button" key={index} className={story===index?'active':''} aria-label={`جملهٔ ${(index+1).toLocaleString('fa-IR')}: ${lines[0]}`} aria-pressed={story===index} onClick={()=>setStory(index)}><span/></button>)}</div><button className="story-next" onClick={()=>setStory((story+1)%stories.length)}>جملهٔ بعد <Icon name="arrow"/></button></div></div>
      {config.searchVisible&&canAccess('search')&&<form className="search-box" role="search" onSubmit={submit}><Icon name="search"/><input aria-label="جست‌وجو در متن کتاب‌ها" value={query} onChange={e=>setQuery(e.target.value)} maxLength={500} placeholder={config.searchPlaceholder}/><button type="submit" aria-label="پیدا کردن موضوع در کتاب‌ها"><Icon name="arrow"/></button></form>}<div className="hero-search-caption"><span>{config.searchCaption}</span><a href="#library-shelf" onClick={event=>{event.preventDefault();document.getElementById('library-shelf')?.scrollIntoView({behavior:motion?'smooth':'auto'});}}>{config.shelfLinkLabel} <Icon name="chevron"/></a></div>
    </div>
    <div ref={art} className={`hero-art${tracking?' is-tracking':''}${!inView?' out-of-view':''}`} aria-label="کتاب سه‌بعدی تعاملی">{config.bookVisible&&<><div className="orbit orbit-outer" aria-hidden="true"/><div className="orbit orbit-inner" aria-hidden="true"/><span className="orbit-star star-a" aria-hidden="true">{motif()}</span><span className="orbit-star star-b" aria-hidden="true">{motif(true)}</span><div className="art-caption" dir="auto">{config.orbitCaption}</div>
      <div className="book-scene" onPointerDown={event=>{if(event.button===0){pointer.current={x:event.clientX,y:event.clientY};dragged.current=false;}}} onPointerMove={event=>{if(opened||!motion||event.pointerType==='touch'&&!pointer.current)return;const box=event.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y=Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));setTracking(true);art.current?.style.setProperty('--tilt-x',`${(.5-y)*12}deg`);art.current?.style.setProperty('--tilt-y',`${(x-.5)*22}deg`);art.current?.style.setProperty('--light-x',`${x*100}%`);art.current?.style.setProperty('--light-y',`${y*100}%`);if(pointer.current&&Math.hypot(event.clientX-pointer.current.x,event.clientY-pointer.current.y)>9)dragged.current=true;}} onPointerLeave={()=>{resetTilt();pointer.current=null;}} onPointerCancel={()=>{resetTilt();pointer.current=null;}}>
        <div className="book-shadow" aria-hidden="true"/><div className={`book-model${opened?' is-open':''}${turned?' is-turned':''}`}>
          <div className="book-back" dir="rtl" aria-hidden={!turned}>{backImage?<img className="hero-book-image" src={backImage} alt="پشت جلد کتاب سه‌بعدی" onError={()=>failImage(config.backImageAssetId)}/>:<><span dir="auto">{config.coverBrand}</span><i>{motif()}</i><p>{config.backText}</p><small>{config.coverSubtitle}</small></>}</div><div className="book-spine" aria-hidden="true"><span>{config.spineText}</span><b dir="ltr">{config.coverBrand.slice(0,1)}</b></div><div className="book-pages" aria-hidden="true"/><div className="book-pages-top" aria-hidden="true"/><div className="book-pages-bottom" aria-hidden="true"/>
          <div className="book-inside" aria-hidden={!opened}>{inside?<img src={inside} alt={`صفحهٔ آغاز ${book?.title||'کتاب'}`} onError={()=>{failImage(config.insideImageAssetId);setInsideImage(null);}}/>:<div className="inside-invitation"><Icon name="book"/><p>{config.insideText}</p></div>}<span>{config.coverSubtitle}</span></div>
          <button className="book-front" type="button" aria-label={turned?'نمایش روی جلد کتاب سه‌بعدی':opened?'بستن جلد کتاب سه‌بعدی':'باز کردن جلد کتاب سه‌بعدی'} aria-expanded={opened} onClick={()=>{if(dragged.current){dragged.current=false;return;}toggleBook();}} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();resetTilt();setOpened(false);setTurned(!turned);}else if(event.key==='Escape'){setOpened(false);setTurned(false);resetTilt();}}}><span className="front-face" aria-hidden={opened||turned}>{frontImage?<img className="hero-book-image" src={frontImage} alt="روی جلد کتاب سه‌بعدی" onError={()=>failImage(config.frontImageAssetId)}/>:<><span className="cover-top"><span dir="auto">{config.coverBrand}</span><span className="cover-edition">{config.coverEdition}</span></span><span className="cover-title">{config.coverTitle}</span><span className="cover-moon" aria-hidden="true"><i/><b>{motif()}</b></span><span className="cover-subtitle">{config.coverSubtitle}</span><span className="cover-rule"/><span className="cover-bottom" dir="auto">{config.coverFooter}</span></>}</span><span className="inner-cover" aria-hidden="true"><span>{config.insideText}</span><i>{motif()}</i></span></button>
        </div>
      </div>
      <div className="book-actions"><button type="button" className="lc-book-hint" aria-label="ورق زدن کتاب سه‌بعدی" aria-expanded={opened} onClick={toggleBook}><i/>{turned?'پشتِ یک جهان تازه':opened?'دوباره لمس کن تا بسته شود':'جلد را لمس کن'}</button><button type="button" aria-label={turned?'نمایش روی کتاب سه‌بعدی':'نمایش پشت کتاب سه‌بعدی'} onClick={()=>{setOpened(false);setTurned(!turned);resetTilt();}}><Icon name="replay"/>{turned?'روی جلد':'بچرخان'}</button><button type="button" className="lc-motion-toggle" aria-pressed={!motion} disabled={reduced} aria-label={reduced?'حرکت‌ها طبق تنظیم مرورگر متوقف‌اند':motion?'توقف حرکت‌ها':'فعال‌کردن حرکت‌ها'} onClick={()=>{setMoving(!moving);resetTilt();}}><Icon name={motion?'pause':'play'}/></button></div></>}
      {config.audioMode!=='OFF'&&<button type="button" className={`audio-note${playing?' is-playing':''}`} disabled={!canListen} aria-label={loading?'لغو دریافت روایت':playing?'مکث روایت کتاب':active&&audio.status==='paused'?'ادامهٔ روایت کتاب':'پخش نمونهٔ روایت واقعی کتاب'} aria-pressed={playing} onClick={()=>void toggleAudio()}><span className="audio-note-icon"><Icon name={playing?'pause':'headphones'}/></span><span className="audio-note-copy"><b>{loading?'در حال آماده‌کردن روایت…':playing?'دارم برایت روایت می‌کنم…':config.audioTitle}</b><small>{active&&audio.elapsedSeconds>0?`${config.audioCaption} · ${time(audio.elapsedSeconds)}`:config.audioCaption}</small></span><span className="waveform" aria-hidden="true">{Array.from({length:11},(_,i)=><i key={i} style={{'--bar':i} as CSSProperties}/>)}</span><span className="audio-progress" aria-hidden="true"><i style={{width:`${active?audio.position:0}%`}}/></span></button>}
      {sampleError&&<p className="lc-audio-error" role="alert">{sampleError}</p>}
    </div><div className="hero-bottom-rule" aria-hidden="true"><span/><Icon name={night?'plus':'sun'}/><span/></div>
  </section>;
}
