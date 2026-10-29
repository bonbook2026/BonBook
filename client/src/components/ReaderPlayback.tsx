import {CSSProperties} from 'react';
import {Icon} from './Icon';
import {BookCover} from './BookCover';
import {LibraryBook,LibraryPage} from '../types';
import {useNarration} from '../hooks/useNarration';
export interface ReaderPlaybackState{
 book:LibraryBook;page:LibraryPage|null;number:number;heading:string;audio:ReturnType<typeof useNarration>;
 active:boolean;fullBook:boolean;continuous:boolean;completed:boolean;playing:boolean;loading:boolean;
 voices:number[];voicePosition:number;previousVoice:number|undefined;nextVoice:number|undefined;
 play:()=>void;move:(direction:1|-1)=>void;toggleContinuous:()=>void;replay:()=>void;
}
function clock(seconds:number){const value=Math.max(0,Math.floor(seconds||0));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;}
export function ReaderPlayback({state}:{state:ReaderPlaybackState}){
 const {book,page,number,heading,audio,active,fullBook,continuous,completed,playing,loading,voices,voicePosition,previousVoice,nextVoice,play,move,toggleContinuous,replay}=state;
 const canPlay=fullBook||Boolean(page&&((continuous&&voices.length)||page.content||page.audioUrl));
 return <><div className="rx-player-inner"><div className="rx-player-book"><div className="rx-cover-tiny"><BookCover book={book} small/></div><div><strong>{heading}</strong><span>{loading?'در حال آماده‌کردن ویس…':page?.audioUrl?'روایت اصلی · صفحهٔ '+number.toLocaleString('fa-IR'):'صفحهٔ '+number.toLocaleString('fa-IR')}</span></div></div>
 <div className="rx-player-center"><div className="rx-play-buttons"><button className="rx-icon-button rx-skip" onClick={()=>move(-1)} disabled={fullBook?voicePosition<=0:previousVoice===undefined} aria-label="روایت قبلی"><Icon name="next" className="rx-flipped"/></button><button className="rx-icon-button rx-rewind" disabled={!active||!audio.durationSeconds} onClick={()=>audio.seek(Math.max(0,audio.elapsedSeconds-10)/audio.durationSeconds*100)} aria-label="ده ثانیه به عقب"><Icon name="replay"/><small>۱۰</small></button><button className="rx-play-button" onClick={play} disabled={!canPlay} aria-label={playing||loading?'مکث روایت':active&&audio.status==='paused'?'ادامهٔ روایت':completed&&continuous?'پخش دوبارهٔ کتاب':continuous&&voices.length?'پخش کامل کتاب':'پخش روایت'}><Icon name={playing||loading?'pause':'play'}/></button><button className="rx-icon-button rx-skip" onClick={()=>move(1)} disabled={fullBook?voicePosition>=voices.length-1:nextVoice===undefined} aria-label="روایت بعدی"><Icon name="next"/></button></div>
 <div className="rx-timeline"><time dir="ltr">{clock(active?audio.elapsedSeconds:0)}</time><input type="range" min={0} max={100} step="0.1" aria-label="موقعیت روایت" disabled={!active||!audio.target?.audioUrl||!audio.durationSeconds||loading} value={active?audio.position:0} style={{'--rx-seek':`${active?audio.position:0}%`} as CSSProperties} onChange={event=>audio.seek(Number(event.target.value))}/><time dir="ltr">{active&&audio.durationSeconds?clock(audio.durationSeconds):'—:—'}</time></div></div>
 <div className="rx-player-options"><label className="rx-rate"><select value={audio.rate} aria-label="سرعت پخش" onChange={event=>audio.setRate(Number(event.target.value))}>{[.75,1,1.25,1.5].map(rate=><option key={rate} value={rate}>{rate}×</option>)}</select></label><button className="rx-continuous" disabled={!voices.length} aria-label="پخش کامل" aria-pressed={continuous&&Boolean(voices.length)} title="ادامهٔ خودکار روایت و رد کردن صفحه‌های بدون ویس" onClick={toggleContinuous}><Icon name="headphones"/><span>{continuous?'پخش کامل':'پخش صفحه'}</span><i/></button>{voices.length>0&&<button className="rx-icon-button rx-restart" onClick={replay} aria-label="پخش از ابتدای کتاب" title="پخش از ابتدای کتاب"><Icon name="replay"/></button>}{active&&audio.status!=='idle'&&!fullBook&&<button className="rx-icon-button rx-stop" onClick={audio.stop} aria-label="پایان پخش"><Icon name="stop"/></button>}</div></div>
 {(audio.playlist?.bookId===book.id||audio.target?.bookId===book.id)&&audio.error&&<div className="rx-player-message" role="alert">{audio.error}<button onClick={()=>completed?replay():(fullBook||audio.target?.audioUrl)?audio.resume():play()}>تلاش دوباره</button></div>}</>;
}
