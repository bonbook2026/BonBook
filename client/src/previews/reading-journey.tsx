import React,{CSSProperties,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReaderBook} from '../components/ReaderBook';
import {ReaderCompanion} from '../components/ReaderCompanion';
import {Icon} from '../components/Icon';
import {LibraryPage} from '../types';
import {departingFlight,journeyColor,journeyPosition,journeySeconds,journeySeek,JOURNEY_PREVIEW_SECONDS,readingJourney,smoothStep} from '../utils/readingJourney';
import '../index.css';
import '../reader-experience.css';
import '../reader-immersive.css';
import '../content-security.css';
import './reading-journey.css';

const TOTAL=338,fa=(n:number)=>n.toLocaleString('fa-IR');
const sample=(number:number):LibraryPage=>({id:number,bookId:5,number,heading:'پیشگفتار',content:'جهان یکی است؛ اما انسان‌ها در جهان‌های متفاوتی زندگی می‌کنند.',imageUrl:`/api/media/journey-page-${number}`,visualMode:'IMAGE',audioUrl:null,audioAssetId:null,audioCues:[],audioCueMode:'NONE',keywords:'',updatedAt:'2026-10-29T00:00:00Z'});
const pages=[sample(11),sample(12)];
const quotes=['جهان یکی است؛ اما انسان‌ها در جهان‌های متفاوتی زندگی می‌کنند.','گاهی یک نگاه تازه، آغازِ جهانی تازه است.','در میان سطرها، جهان‌های تازه‌ای کشف کن.','هر پایان، فرصتی برای یک آغاز تازه است.'];
function JourneyPreview(){
  const [position,setPosition]=useState(0),[playing,setPlaying]=useState(false),[startNight,setStartNight]=useState(false),[dragging,setDragging]=useState(false),[trail,setTrail]=useState<{x:number;y:number}[]>([]),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const orbit=useRef<HTMLDivElement>(null),scene=useRef<HTMLDivElement>(null),time=useRef(0),dragStarted=useRef(false),[fullscreen,setFullscreen]=useState(false);
  const sky=readingJourney(position,TOTAL,startNight),departure=departingFlight(sky.departure),activeQuote=quotes[Math.min(3,Math.floor(sky.progress*4))];
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{const change=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',change);return()=>document.removeEventListener('fullscreenchange',change);},[]);
  useEffect(()=>{
    if(!playing||dragging)return;
    let frame=0,last=performance.now();
    const tick=(now:number)=>{const delta=Math.min(.1,(now-last)/1000);last=now;if(!document.hidden){time.current=Math.min(JOURNEY_PREVIEW_SECONDS,time.current+delta);setPosition(journeyPosition(time.current,TOTAL));}if(time.current>=JOURNEY_PREVIEW_SECONDS){setPlaying(false);return;}frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,dragging]);
  const seek=(next:number)=>{const value=Math.min(TOTAL,Math.max(0,next));time.current=journeySeconds(value,TOTAL);setPosition(value);};
  const start=(night:boolean)=>{setStartNight(night);seek(0);setPlaying(false);setTrail([]);};
  const play=()=>{if(position>=TOTAL)seek(0);setPlaying(value=>!value);};
  const pointerSeek=(event:React.PointerEvent)=>{
    const bounds=orbit.current!.getBoundingClientRect(),fraction=Math.min(1,Math.max(0,((event.clientX-bounds.left)/bounds.width-.08)/.84));
    const next=journeySeek(fraction,TOTAL),state=readingJourney(next,TOTAL,startNight);seek(next);setTrail(old=>[...old.slice(-22),{x:state.x*10,y:state.y*2.2}]);
  };
  const finishDrag=(event:React.PointerEvent)=>{if(!dragStarted.current)return;dragStarted.current=false;event.currentTarget.releasePointerCapture(event.pointerId);setDragging(false);setTrail([]);setPlaying(time.current<JOURNEY_PREVIEW_SECONDS);};
  // Keep each control's foreground/surface paired while the sky blends continuously.
  const chrome=sky.night>.64?1:0;
  const style={
    '--j-ink':journeyColor([38,75,54],[225,237,255],chrome),'--j-muted':journeyColor([98,129,108],[160,183,217],chrome),'--j-panel':journeyColor([251,254,249],[18,31,53],chrome),'--j-line':journeyColor([214,228,211],[49,69,101],chrome),'--j-accent':journeyColor([47,106,76],[176,207,251],chrome),'--j-button-ink':journeyColor([255,255,249],[18,34,58],chrome),'--j-night':sky.night,'--j-night-sky':smoothStep(.25,.9,sky.night),'--j-dusk':sky.dusk,'--j-paper':journeyColor([255,253,248],[202,217,237],sky.night),'--rx-line':'var(--j-line)','--rx-accent':'var(--j-accent)',
  } as CSSProperties;
  const phase=sky.progress===0?(startNight?'آغاز در آبیِ مهتاب':'آغاز در روشنای روز'):sky.progress===1?(startNight?'به روشنایی رسیدیم':'به آرامش شب رسیدیم'):sky.progress<.32?(startNight?'صبح، آهسته نزدیک می‌شود':'روشنایی همراه سطرها'):sky.progress<.65?(startNight?'طلوع میان واژه‌ها':'غروب میان واژه‌ها'):(startNight?'خورشید در راه است':'ماه از راه می‌رسد');
  return <div ref={scene} style={style} className={`journey-preview ${sky.night>.5?'rx-night':'rx-paper'}${dragging?' is-dragging':''}${reduced?' is-reduced':''}`}>
    <div className="journey-world" aria-hidden="true"><div className="journey-day"/><div className="journey-dusk"/><div className="journey-night"/><div className="journey-nebula"/>
      <div className="journey-stars">{Array.from({length:60},(_,i)=><i key={i} style={{left:`${(i*37+5)%100}%`,top:`${(i*23+8)%84}%`,animationDelay:`${i%8*-1.3}s`,width:i%7===0?3:1.5,height:i%7===0?3:1.5}}/>)}</div>
      <span className="journey-meteor"/><span className="journey-meteor meteor-second"/><div className="journey-ground ground-far"/><div className="journey-ground ground-near"/>
    </div>
    <header className="journey-header"><div className="journey-brand"><span>BonBook<span className="brand-dot">.</span></span><span className="journey-preview-tag">پیش‌نمایش تعاملی</span></div><div className="journey-title"><h1>بینش انسان و معرفت — جلد اول</h1><p>یک سفر، از اولین سطر تا آخرین واژه</p></div>
      <div className="journey-start" role="group" aria-label="تم ابتدای کتاب"><button aria-pressed={!startNight} onClick={()=>start(false)}><Icon name="sun"/>شروع با روز</button><button aria-pressed={startNight} onClick={()=>start(true)}><Icon name="moon"/>شروع با شب</button></div>
    </header>
    <main className="journey-stage">
      <div className="journey-sky" ref={orbit}>
        <div className="journey-phase"><span className="journey-phase-dot"/>{phase}</div>
        <svg className="journey-arc" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true"><path d="M80 147 Q500 6 920 147"/></svg>
        {dragging&&trail.length>1&&<svg className="journey-touch-trail" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true"><polyline points={trail.map(p=>`${p.x},${p.y}`).join(' ')}/></svg>}
        <div role="slider" tabIndex={0} aria-label="خورشید و ماه؛ جابه‌جایی در کتاب" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={sky.page} aria-valuetext={`صفحهٔ ${fa(sky.page)}؛ ${phase}`} data-edge={sky.x<20?'left':sky.x>80?'right':'middle'} className="journey-orb" style={{left:`${sky.x}%`,top:`${sky.y}%`}}
          onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);dragStarted.current=true;setDragging(true);setTrail([]);}}
          onPointerMove={event=>{if(dragStarted.current)pointerSeek(event);}} onPointerUp={finishDrag}
          onPointerCancel={event=>{dragStarted.current=false;setDragging(false);setPlaying(false);setTrail([]);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
          onKeyDown={event=>{const delta=event.shiftKey?10:1;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();seek(event.key==='Home'?0:event.key==='End'?TOTAL:position+(event.key==='ArrowRight'?delta:-delta));}}}>
          <span className="orb-glow"/><span className="orb-sun" style={{opacity:1-smoothStep(.55,.9,sky.night)}}/><span className="orb-moon" style={{opacity:smoothStep(.55,.9,sky.night)}}><i/><i/><i/></span><span className="orb-touch-ring"/>
          <span className="orb-page">{dragging?`صفحهٔ ${fa(sky.page)}`:'بکش و در کتاب سفر کن'}<Icon name="arrow"/></span>
        </div>
        <div className="journey-sky-ends" aria-hidden="true"><span>{startNight?'مهتاب':'روز روشن'}</span><span>{startNight?'صبح روشن':'آرامش شب'}</span></div>
      </div>
      <div className="journey-book-space"><div className="journey-book-wrap">
        <div className={`journey-perch outgoing-perch${sky.departure>0&&sky.departure<1?' is-flying':''}`} aria-hidden={sky.departure>=1} style={{transform:`translate(${departure.x}px,${departure.y}px) rotate(${departure.angle}deg) scale(${1-sky.departure*.25})`,opacity:1-smoothStep(.82,1,sky.departure),pointerEvents:sky.departure>.95?'none':'auto'}}><ReaderCompanion night={startNight} moving={!reduced}/></div>
        <div className={`journey-perch incoming-perch${sky.arrival>0&&sky.arrival<1?' is-flying':''}`} aria-hidden={sky.arrival<=0} style={{transform:`translate(${(1-sky.arrival)*220}px,${-(1-sky.arrival)*470}px) rotate(${(1-sky.arrival)*-24}deg) scale(${.75+sky.arrival*.25})`,opacity:sky.arrival,pointerEvents:sky.arrival<.5?'none':'auto'}}><ReaderCompanion night={!startNight} moving={!reduced}/></div>
        <ReaderBook page={pages[0]} facing={pages[1]} hasFacing title="بینش انسان و معرفت" single={false} onZoom={()=>seek(position+1)} onFacing={()=>seek(position+1)}/>
      </div><span className="journey-sample-note">تصویر نمونهٔ کتاب · جای خواندن با نشانگر پایین شبیه‌سازی می‌شود</span></div>
    </main>
    <section className="journey-caption" aria-label="متن همراه روایت نمایشی"><div className="journey-caption-meta"><span className="journey-wave"><i/><i/><i/><i/></span><span>صفحهٔ {fa(sky.page)} از {fa(TOTAL)}</span></div><p key={activeQuote}>{activeQuote}</p></section>
    <footer className="journey-player"><div className="journey-player-label"><Icon name="headphones"/><div><strong>از روز تا رؤیا</strong><span>پخش نمایشی حرکت · بدون ویس واقعی</span></div></div>
      <div className="journey-play-controls"><button aria-label="صفحهٔ قبل" onClick={()=>{setPlaying(false);seek(position-1);}} disabled={position<=0}><Icon name="chevron"/></button><button className="journey-play" aria-label={playing?'توقف پیش‌نمایش':'پخش پیش‌نمایش'} onClick={play}><Icon name={playing?'pause':'play'}/></button><button aria-label="صفحهٔ بعد" onClick={()=>{setPlaying(false);seek(position+1);}} disabled={position>=TOTAL}><Icon name="chevron" className="flip"/></button></div>
      <div className="journey-duration"><button aria-label="شروع دوبارهٔ پیش‌نمایش" onClick={()=>{seek(0);setPlaying(false);}}><Icon name="replay"/></button><button aria-label={fullscreen?'خروج از تمام‌صفحه':'نمایش تمام‌صفحه'} onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void scene.current?.requestFullscreen?.();}}><Icon name="expand"/></button><span dir="ltr">{Math.round(time.current)} / 40 s</span></div>
      <label className="journey-progress"><span>جای خواندن</span><input type="range" min={0} max={TOTAL} step={.1} value={position} aria-label="جای خواندن در کتاب" dir="ltr" onChange={event=>{setPlaying(false);seek(Number(event.target.value));}} style={{'--j-percent':`${position/TOTAL*100}%`} as CSSProperties}/><span>{fa(sky.page)} / {fa(TOTAL)}</span></label>
    </footer>
  </div>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<JourneyPreview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
