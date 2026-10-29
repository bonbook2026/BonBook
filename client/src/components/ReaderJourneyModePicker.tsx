import {useEffect,useRef,useState} from 'react';
import {JourneyMode} from '../utils/readingJourney';
import {Icon} from './Icon';

const options:{mode:JourneyMode;label:string;description:string}[]=[{mode:'cycle',label:'روز و شب',description:'سفر میان روشنایی و مهتاب'},{mode:'night',label:'فقط شب',description:'نیم‌ماه تا ماه کامل؛ همراه جغدها'},{mode:'day',label:'فقط روز',description:'طلوع تا نزدیک غروب؛ همراه گربه'}];
export function JourneyModeIcon({mode}:{mode:JourneyMode}){
 if(mode!=='cycle')return <Icon name={mode==='night'?'moon':'sun'}/>;
 return <svg className="journey-cycle-icon" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path className="cycle-sun" d="M14 6a6 6 0 0 0 0 12V6ZM14 2v1M14 21v1M4 12H2M6 5 4.5 3.5M6 19l-1.5 1.5"/><path className="cycle-moon" d="M14 6a6 6 0 0 1 0 12c3.8-2.5 3.8-9.5 0-12Z"/><path className="cycle-star" d="M23 4v3m-1.5-1.5h3M24 17v2m-1-1h2"/></svg>;
}
export function ReaderJourneyModePicker({mode,onMode,startNight,onDirection}:{mode:JourneyMode;onMode:(mode:JourneyMode)=>void;startNight:boolean;onDirection:()=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const selected=options.find(option=>option.mode===mode)!;
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[open]);
 const close=()=>{setOpen(false);trigger.current?.focus({preventScroll:true});};
 return <div ref={root} className="journey-mode-picker" onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}}}>
  <button ref={trigger} className="rx-icon-button journey-mode-trigger" aria-label={`فضای کتاب: ${selected.label}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><JourneyModeIcon mode={mode}/><span>{selected.label}</span><span className="journey-mode-chevron" aria-hidden="true">⌄</span></button>
  {open&&<section className="journey-mode-panel" role="dialog" aria-label="انتخاب فضای کتاب"><div className="journey-mode-heading"><strong>فضای دلخواهت را انتخاب کن</strong><button className="rx-icon-button" aria-label="بستن انتخاب فضای کتاب" onClick={close}><Icon name="close"/></button></div><div role="group" aria-label="حالت آسمان کتاب">{options.map(option=><button key={option.mode} className="journey-mode-option" aria-label={option.label} aria-pressed={mode===option.mode} onClick={()=>{onMode(option.mode);close();}}><JourneyModeIcon mode={option.mode}/><span><strong>{option.label}</strong><small>{option.description}</small></span><span className="journey-mode-check" aria-hidden="true">{mode===option.mode?'✓':''}</span></button>)}</div>{mode==='cycle'&&<button className="journey-direction" onClick={onDirection}><Icon name={startNight?'moon':'sun'}/><span>{startNight?'شب ← روز':'روز ← شب'}</span><small>تغییر جهت سفر</small></button>}<p>حیوان‌ها را لمس کن تا با تو بازی کنند.</p></section>}
 </div>;
}
