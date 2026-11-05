import {useEffect,useRef,useState} from 'react';
import {LibraryPage} from '../types';
import {schedule} from '../../../shared/narrative-scenes.cjs';
import {comicText,comicSheets,panelSpans} from '../../../shared/comic-layout.cjs';
import {mediaUrl} from '../services/api';
import {ReaderPageCanvas} from './ReaderPageCanvas';
import {ReaderAccountStamp} from './ReaderProtection';
import './ComicStory.css';
export function ComicStory({page,time,playing,onSeek}:{page:LibraryPage;time:number;playing:boolean;onSeek?:(time:number)=>void}){
 const scenes=schedule(page.scenes||[],page.audioCues||[]),[manual,setManual]=useState<string|null>(null),[failed,setFailed]=useState<string[]>([]),activeRef=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{setManual(null);setFailed([]);},[page.id]);useEffect(()=>{if(playing)setManual(null);},[playing]);
 let index=0;for(let i=0;i<scenes.length;i++)if(scenes[i].time!==null&&scenes[i].time!<=time)index=i;if(!playing&&manual){const i=scenes.findIndex(s=>s.id===manual);if(i>=0)index=i;}
 const sheets=comicSheets(scenes),sheetNumber=Math.floor(index/7),sheet=sheets[sheetNumber]||[],spans=panelSpans(sheet.length),active=scenes[index];
 useEffect(()=>{if(playing)activeRef.current?.scrollIntoView({block:'nearest',inline:'nearest',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});},[playing,active?.id]);
 return <section className="rx-comic-stage" aria-label="صفحهٔ کمیک همراه روایت" onContextMenu={e=>e.preventDefault()} onDragStart={e=>e.preventDefault()}><div className="rx-comic-paper"><div className="rx-comic-grid">{sheet.map((scene,i)=>{
  const text=comicText(page.content,scene),url=mediaUrl(scene.imageUrl||(scenes.length===1?page.imageUrl||null:null)),foreground=mediaUrl(scene.foregroundUrl||null),selected=scene.id===active?.id;
  return <button type="button" key={scene.id} ref={selected?activeRef:undefined} className={`rx-comic-panel comic-span-${spans[i]}${selected?' is-active':''}${playing&&selected?' is-reading':''}`} aria-current={selected?'step':undefined} aria-label={`کادر ${(sheetNumber*7+i+1).toLocaleString('fa-IR')}: ${scene.title}`} onClick={()=>{if(scene.time!==null&&onSeek)onSeek(scene.time);if(!playing)setManual(scene.id);}}>
  {url&&!failed.includes(url)?<ReaderPageCanvas key={url} url={url} label={scene.title} onError={()=>setFailed(old=>[...old,url])}/>:<span className="rx-comic-placeholder">تصویر کادر {(sheetNumber*7+i+1).toLocaleString('fa-IR')}</span>}
  {foreground&&<span className="rx-comic-actor"><ReaderPageCanvas key={foreground} url={foreground} label="شخصیت روایت" onError={()=>{}}/></span>}{text.narration&&<span className="rx-comic-narration">{text.narration}</span>}{text.dialogue&&<span className="rx-comic-dialogue">{text.dialogue}</span>}<bdi className="rx-comic-number">{(sheetNumber*7+i+1).toLocaleString('fa-IR')}</bdi></button>;
 })}</div><span className="rx-comic-sheet-number">صفحهٔ {page.number.toLocaleString('fa-IR')} · برگ {(sheetNumber+1).toLocaleString('fa-IR')} از {sheets.length.toLocaleString('fa-IR')}</span><ReaderAccountStamp code={page.protection?.watermark}/></div>
 <nav className="rx-story-scenes" aria-label="انتخاب کادر کمیک">{scenes.map((s,i)=><button type="button" key={s.id} className={s.id===active?.id?'is-active':''} aria-current={s.id===active?.id?'step':undefined} title={s.title} onClick={()=>{if(s.time!==null&&onSeek)onSeek(s.time);if(!playing)setManual(s.id);}}>{(i+1).toLocaleString('fa-IR')}</button>)}</nav>{scenes.some(s=>s.time===null)&&<small className="rx-story-pending">همراهی خودکار صدا برای کادرهای دارای تطبیق گفتار فعال است.</small>}</section>;
}
