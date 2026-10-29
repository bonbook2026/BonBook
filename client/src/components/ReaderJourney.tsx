import {CSSProperties} from 'react';
import {Icon} from './Icon';
import {ReaderAtmosphere} from './ReaderAtmosphere';
import {ReaderCompanion} from './ReaderCompanion';
import {ReaderCat} from './ReaderCat';
import {ReaderNightOwls} from './ReaderNightOwls';
import {ReaderMoon} from './ReaderMoon';
import {useReaderJourney} from '../hooks/useReaderJourney';
import {departingFlight,journeyColor,readingJourney,smoothStep} from '../utils/readingJourney';
import '../reader-journey.css';
type Sky=ReturnType<typeof readingJourney>;
type Controller=ReturnType<typeof useReaderJourney>;

export function readerJourneyStyle(sky:Sky):CSSProperties{
 const chrome=sky.night>.64?1:0;
 return {'--j-night':sky.night,'--j-dusk':sky.dusk,'--j-night-sky':smoothStep(.25,.9,sky.night),'--j-paper':journeyColor([255,253,248],[202,217,237],sky.night),'--j-halo':journeyColor([255,226,148],[180,207,244],sky.night),'--rx-bg':journeyColor([245,250,240],[11,20,40],chrome),'--rx-surface':journeyColor([251,254,249],[18,31,53],chrome),'--rx-ink':journeyColor([38,75,54],[225,237,255],chrome),'--rx-muted':journeyColor([98,129,108],[160,183,217],chrome),'--rx-line':journeyColor([214,228,211],[49,69,101],chrome),'--rx-accent':journeyColor([47,106,76],[176,207,251],chrome),'--rx-soft':journeyColor([226,238,221],[29,51,79],chrome),'--rx-gold':journeyColor([164,132,66],[185,207,232],chrome)} as CSSProperties;
}
export function ReaderJourneyBackdrop({moving}:{moving:boolean}){
 return <div className="reader-journey-world" aria-hidden="true"><div className="journey-day-layer"><ReaderAtmosphere night={false} moving={moving} animals={false}/></div><div className="journey-night-layer"><ReaderAtmosphere night moving={moving}/></div><div className="journey-dusk-layer"/></div>;
}
export function ReaderJourneySky({sky,startNight,total,control}:{sky:Sky;startNight:boolean;total:number;control:Controller}){
 const phase=sky.mode==='night'?(sky.progress===0?'نیم‌ماه، آغاز یک شب آرام':sky.progress===1?'ماه کامل، آرامش پایان کتاب':'ماه آرام‌آرام کامل می‌شود'):sky.mode==='day'?(sky.progress<.2?'طلوع، آغاز یک صبح تازه':sky.progress>.75?'نور طلاییِ نزدیک غروب':'روشنایی روز میان واژه‌ها'):sky.progress===0?(startNight?'آغاز در آبیِ مهتاب':'آغاز در روشنای روز'):sky.progress===1?(startNight?'به روشنایی رسیدیم':'به آرامش شب رسیدیم'):sky.progress<.32?(startNight?'صبح، آهسته نزدیک می‌شود':'روشنایی همراه سطرها'):sky.progress<.65?(startNight?'طلوع میان واژه‌ها':'غروب میان واژه‌ها'):(startNight?'خورشید در راه است':'ماه از راه می‌رسد');
 return <div className="journey-sky" ref={control.orbit}>
  <div className="journey-phase"><span/>{phase}</div>
  <svg className="journey-arc" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true"><path d="M80 147 Q500 6 920 147"/></svg>
  {control.dragging&&control.trail.length>1&&<svg className="journey-touch-trail" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true"><polyline points={control.trail.map(point=>`${point.x},${point.y}`).join(' ')}/></svg>}
  <div role="slider" tabIndex={0} className="journey-orb" aria-label="خورشید و ماه؛ جابه‌جایی در کتاب" aria-valuemin={1} aria-valuemax={Math.max(1,total)} aria-valuenow={sky.page} aria-valuetext={`صفحهٔ ${sky.page.toLocaleString('fa-IR')}؛ ${phase}`} aria-busy={control.busy} data-edge={sky.x<20?'left':sky.x>80?'right':'middle'} style={{left:`${sky.x}%`,top:`${sky.y}%`}} onPointerDown={control.onPointerDown} onPointerMove={control.onPointerMove} onPointerUp={control.onPointerUp} onPointerCancel={control.onPointerCancel} onLostPointerCapture={control.onLostPointerCapture} onKeyDown={control.onKeyDown} onContextMenu={event=>event.preventDefault()}>
   <span className="orb-glow"/><span className="orb-sun" style={{opacity:sky.sunOpacity}}/><span className="orb-moon" style={{opacity:sky.moonOpacity}}>{sky.moonOpacity>0&&<ReaderMoon illumination={sky.moonIllumination}/>}</span><span className="orb-touch-ring"/>
   <span className="orb-page">{control.dragging||control.busy?`صفحهٔ ${sky.page.toLocaleString('fa-IR')}`:'بکش و در کتاب سفر کن'}<Icon name="arrow"/></span>
  </div>
  <div className="journey-sky-ends" aria-hidden="true"><span>{sky.mode==='night'?'نیم‌ماه':sky.mode==='day'?'طلوع خورشید':startNight?'مهتاب':'روز روشن'}</span><span>{sky.mode==='night'?'ماه کامل':sky.mode==='day'?'نزدیک غروب':startNight?'صبح روشن':'آرامش شب'}</span></div>
 </div>;
}
export function ReaderJourneyCompanions({sky,startNight,moving}:{sky:Sky;startNight:boolean;moving:boolean}){
 const flight=departingFlight(sky.departure);
 const outgoingNight=sky.mode==='night'||(sky.mode==='cycle'&&startNight),outgoingTransform=sky.mode==='cycle'?`translate(${flight.x}px,${flight.y}px) rotate(${flight.angle}deg) scale(${1-sky.departure*.25})`:`translate(${-75*sky.departure}vw,${-120*sky.departure}px) rotate(${-18*sky.departure}deg)`;
 const incomingTransform=sky.mode==='day'?`translate(${(1-sky.arrival)*65}vw,0)` :sky.mode==='night'?'none':`translate(${(1-sky.arrival)*220}px,${-(1-sky.arrival)*470}px) rotate(${(1-sky.arrival)*-24}deg) scale(${.75+sky.arrival*.25})`;
 const incomingVisible=sky.mode==='night'?sky.progress>.48:sky.arrival>0;
 return <>
  <div className={`journey-perch outgoing-perch${sky.departure>0&&sky.departure<1?' is-flying':''}`} aria-hidden={sky.departure>=1} style={{transform:outgoingTransform,opacity:1-smoothStep(.82,1,sky.departure),pointerEvents:sky.departure>.95?'none':'auto'}}><ReaderCompanion night={outgoingNight} moving={moving}/></div>
  <div className={`journey-perch incoming-perch${sky.mode==='day'?' cat-perch':sky.mode==='night'?' owl-pair-perch':''}${sky.mode==='cycle'&&sky.arrival>0&&sky.arrival<1?' is-flying':''}`} aria-hidden={!incomingVisible} style={{transform:incomingTransform,opacity:sky.mode==='night'?1:sky.arrival,pointerEvents:incomingVisible?'auto':'none'}}>{sky.mode==='day'?<ReaderCat moving={moving} arrived={sky.arrival>=.999}/>:sky.mode==='night'?<ReaderNightOwls progress={sky.progress} moving={moving}/>:<ReaderCompanion night={!startNight} moving={moving}/>}</div>
 </>;
}
