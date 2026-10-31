import {useEffect,useRef,useState} from 'react';
import {LibraryBook,LibraryPage} from '../types';
import {Icon} from './Icon';
import {ReaderBook} from './ReaderBook';
import {ReadAlongText} from './ReadAlongText';
import {ReaderPlayback,ReaderPlaybackState} from './ReaderPlayback';
import {ReaderAccountStamp} from './ReaderProtection';
import {ReaderJourneyBackdrop,ReaderJourneySky,ReaderJourneyCompanions,readerJourneyStyle} from './ReaderJourney';
import {useReaderJourney} from '../hooks/useReaderJourney';
import {JOURNEY_MODE_KEY,JourneyMode,journeyReadingPosition,parseJourneyMode,readingJourney} from '../utils/readingJourney';
import {ReaderJourneyModePicker} from './ReaderJourneyModePicker';
import {ImageReadingLine,ImageReadingWord} from '../utils/pageLineFocus';
import {ReaderAmbientAnimals} from './ReaderAmbientAnimals';
interface ImmersiveProps{
 words?:ImageReadingWord[];facingWords?:ImageReadingWord[];facingLines:ImageReadingLine[];focusWord:ImageReadingWord|null;onReadWord:(word:ImageReadingWord|null,page:LibraryPage)=>void;readError:string;
 lines:ImageReadingLine[];onReadLine:(line:ImageReadingLine)=>void;
 eye:boolean;onEye:()=>void;focusLine:ImageReadingLine|null;activeOnLeft?:boolean;
 open:boolean;onClose:()=>void;book:LibraryBook|null;page:LibraryPage|null;visualPage:LibraryPage|null;facing:LibraryPage|null;hasFacing:boolean;
 number:number;heading:string;night:boolean;onTheme:()=>void;single:boolean;onSingle:()=>void;
 previous:number|undefined;next:number|undefined;onGo:(number:number)=>void;onFacing:()=>void;
 offset:number;terms:string[];playback:ReaderPlaybackState|null;
 onJourneySeek:(position:number)=>Promise<void>;onJourneyDragStart:()=>void;onJourneyDragCancel:()=>void;
}
function motionPreference(){try{return localStorage.getItem('bonbook_reader_atmosphere')!=='off';}catch{return true;}}
function journeyPreference(){try{return parseJourneyMode(localStorage.getItem(JOURNEY_MODE_KEY));}catch{return 'cycle' as JourneyMode;}}
export function ReaderImmersive(props:ImmersiveProps){
 const {words,facingWords,facingLines,focusWord,onReadWord,readError,lines,onReadLine,eye,onEye,focusLine,open,onClose,book,page,visualPage,facing,hasFacing,number,heading,night,onTheme,single,onSingle,previous,next,onGo,onFacing,offset,terms,playback,onJourneySeek,onJourneyDragStart,onJourneyDragCancel}=props;
 const dialog=useRef<HTMLDialogElement>(null),frame=useRef<HTMLDivElement>(null);
 const [captions,setCaptions]=useState(true),[text,setText]=useState(false),[moving,setMoving]=useState(motionPreference),[reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches),[visible,setVisible]=useState(!document.hidden),[nativeFullscreen,setNativeFullscreen]=useState(false),[message,setMessage]=useState('');
 const [journeyMode,setJourneyMode]=useState<JourneyMode>(journeyPreference);
 const total=book?.pages?.length||0,position=journeyReadingPosition(number,book?.pages||[],playback?.active?playback.audio.position:0);
 const journey=useReaderJourney({position,total,enabled:open,scope:book?.id||0,onSeek:onJourneySeek,onStart:onJourneyDragStart,onCancel:onJourneyDragCancel}),sky=readingJourney(journey.position,Math.max(1,total),night,journeyMode),motion=moving&&!reduced&&visible;
 useEffect(()=>{try{localStorage.setItem(JOURNEY_MODE_KEY,journeyMode);}catch{}},[journeyMode]);
 useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===JOURNEY_MODE_KEY)setJourneyMode(parseJourneyMode(event.newValue));};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches),visibility=()=>setVisible(!document.hidden);media.addEventListener('change',change);document.addEventListener('visibilitychange',visibility);return()=>{media.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{try{localStorage.setItem('bonbook_reader_atmosphere',moving?'on':'off');}catch{}},[moving]);
 useEffect(()=>{const change=()=>setNativeFullscreen(document.fullscreenElement===frame.current);document.addEventListener('fullscreenchange',change);return()=>document.removeEventListener('fullscreenchange',change);},[]);
 useEffect(()=>{
  const element=dialog.current;if(!element||!open)return;
  const focus=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';if(!element.open)element.showModal();
  return()=>{if(document.fullscreenElement===frame.current)void document.exitFullscreen().catch(()=>{});if(element.open)element.close();document.body.style.overflow=overflow;if(focus?.isConnected)focus.focus({preventScroll:true});};
 },[open]);
 const toggleFullscreen=()=>{if(nativeFullscreen)void document.exitFullscreen().catch(()=>{});else if(frame.current?.requestFullscreen)void frame.current.requestFullscreen().catch(()=>setMessage('نمای کامل داخل مرورگر فعال است.'));};
 return <dialog ref={dialog} style={readerJourneyStyle(sky)} data-journey-mode={journeyMode} className={`rx-immersive rx-zoom reader-journey rx-${sky.night>.64?'night':'paper'}`} aria-label="تصویر کامل کتاب با زیرنویس" onCancel={onClose} onClose={onClose} onKeyDown={event=>{if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||(event.target as HTMLElement).closest('input,select,textarea,[role=slider],[contenteditable=true]'))return;const target=event.key==='ArrowLeft'?next:event.key==='ArrowRight'?previous:undefined;if(target!==undefined){event.preventDefault();onGo(target);}}}>
 {open&&book&&<div ref={frame} className={`rx-immersive-frame reader-journey-frame${playback?.playing?' rx-playing':''}${journey.dragging?' is-dragging':''}${motion?'':' journey-still'}`}><ReaderJourneyBackdrop moving={motion}/><ReaderAmbientAnimals night={sky.night>.64} moving={motion}/>
 <header className="rx-immersive-header"><div className="rx-immersive-title"><span className="rx-eyebrow">چشم‌ها بخوانند، گوش‌ها بشنوند</span><h2>{book.title}</h2><p>{heading} · صفحهٔ {number.toLocaleString('fa-IR')}</p></div><div className="rx-immersive-tools"><button className="rx-icon-button rx-eye-toggle" aria-label="نزدیک‌کردن کتاب و دنبال‌کردن خط" aria-pressed={eye} onClick={onEye}><Icon name="eye"/></button><button className="rx-icon-button" aria-label={single?'نمای دوصفحه در تصویر کامل':'نمای تک‌صفحه در تصویر کامل'} aria-pressed={!single} onClick={onSingle}><Icon name="book"/></button><button className="rx-icon-button" aria-label="نمایش زیرنویس همراه کتاب" aria-pressed={captions} onClick={()=>setCaptions(value=>!value)}><Icon name="orders"/></button><button className="rx-icon-button" aria-label="نمایش متن کامل در تصویر کامل" aria-pressed={text} onClick={()=>setText(value=>!value)}><Icon name="search"/></button><ReaderJourneyModePicker mode={journeyMode} onMode={setJourneyMode} startNight={night} onDirection={onTheme}/><button className="rx-icon-button" disabled={reduced} aria-label={reduced?'حرکت پس‌زمینه طبق تنظیم مرورگر متوقف است':moving?'توقف حرکت پس‌زمینه':'فعال‌کردن حرکت پس‌زمینه'} aria-pressed={moving&&!reduced} onClick={()=>setMoving(value=>!value)}><Icon name={moving&&!reduced?'pause':'play'}/></button>{document.fullscreenEnabled&&<button className="rx-icon-button rx-native-fullscreen" aria-label={nativeFullscreen?'خروج از تمام‌صفحهٔ نمایشگر':'تمام‌صفحهٔ نمایشگر'} onClick={toggleFullscreen}><Icon name="expand"/></button>}<button className="rx-icon-button rx-immersive-close" onClick={onClose} aria-label="بستن تصویر کامل کتاب"><Icon name="close"/></button></div></header>
 <main className={`rx-immersive-stage${single?' immersive-single':''}`} aria-label="تصویر کتاب و زیرنویس همراه" aria-busy={!page}><button className="rx-page-arrow rx-previous" disabled={previous===undefined} onClick={()=>previous!==undefined&&onGo(previous)} aria-label="صفحهٔ قبل در تصویر کامل"><Icon name="chevron" className="rx-flipped"/></button>
 <div className="rx-immersive-canvas"><ReaderJourneySky sky={sky} startNight={night} total={total} control={journey}/>{visualPage&&<><ReaderBook activeOnLeft={props.activeOnLeft} words={words} facingWords={facingWords} facingLines={facingLines} focusWord={focusWord} onReadWord={onReadWord} lines={lines} onReadLine={onReadLine} eye={eye} focusLine={focusLine} page={visualPage} facing={facing} hasFacing={hasFacing} title={book.title} single={single} onZoom={()=>setCaptions(value=>!value)} zoomLabel="نمایش یا پنهان‌کردن زیرنویس همراه کتاب" onFacing={onFacing}/><ReaderJourneyCompanions sky={sky} startNight={night} moving={motion}/></>}{!page&&<div className="rx-immersive-loading" role="status">در حال ورق‌زدن…</div>}</div>
 <button className="rx-page-arrow rx-next" disabled={next===undefined} onClick={()=>next!==undefined&&onGo(next)} aria-label="صفحهٔ بعد در تصویر کامل"><Icon name="chevron"/></button>
 {text&&<aside className="rx-immersive-transcript" aria-label="متن کامل همراه صدا"><div><h3>متن همراه صدا</h3><button className="rx-icon-button" aria-label="بستن متن کامل" onClick={()=>setText(false)}><Icon name="close"/></button></div>{page?.content&&page.visualMode!=='IMAGE'?<ReadAlongText key={`${book.id}-${number}`} text={page.content} offset={offset} follow terms={terms} contained/>:<p>متن قابل خواندن برای این صفحه ثبت نشده است.</p>}</aside>}</main>
 {captions&&page&&<section className="rx-immersive-caption" aria-label="زیرنویس همراه صدا زیر کتاب"><span className="rx-caption-page">صفحهٔ {number.toLocaleString('fa-IR')}<span className="rx-sound-wave" aria-hidden="true"><i/><i/><i/><i/></span></span>{page.content&&page.visualMode!=='IMAGE'?<ReadAlongText key={`${book.id}-${number}`} text={page.content} offset={offset} follow terms={terms} captions captionLength={single?44:72} contained/>:<p>{page.audioUrl?'روایت این صفحه را بشنو؛ زیرنویس این صفحه ثبت نشده است.':'تصویر اصلی این صفحهٔ کتاب'}</p>}</section>}
 <ReaderAccountStamp code={page?.protection?.watermark}/>{(readError||message||journey.error)&&<p className="rx-immersive-status" role="status">{readError||journey.error||message}</p>}<footer className="rx-immersive-player" aria-label="پخش‌کننده در تصویر کامل">{playback&&<ReaderPlayback state={playback}/>}</footer></div>}
 </dialog>;
}
