import {useEffect,useState,CSSProperties} from 'react';
import {LibraryPage} from '../types';
import {schedule} from '../../../shared/narrative-scenes.cjs';
import {mediaUrl} from '../services/api';
import {ReaderPageCanvas} from './ReaderPageCanvas';
import {ReaderAccountStamp} from './ReaderProtection';
import './IllustratedStory.css';

export function IllustratedStory({page,time,playing,onSeek}:{page:LibraryPage;time:number;playing:boolean;onSeek?:(time:number)=>void}){
 const scenes=schedule(page.scenes||[],page.audioCues||[]),[manual,setManual]=useState<string|null>(null),[failed,setFailed]=useState<string|null>(null);
 useEffect(()=>setManual(null),[page.id]);useEffect(()=>{if(playing)setManual(null);},[playing]);
 let index=0;for(let i=0;i<scenes.length;i++)if(scenes[i].time!==null&&scenes[i].time!<=time)index=i;
 if(!playing&&manual){const found=scenes.findIndex(s=>s.id===manual);if(found>=0)index=found;}
 const scene=scenes[index];const url=mediaUrl(scene?.imageUrl||page.imageUrl||null);
 const foreground=mediaUrl(scene?.foregroundUrl||null);
 const elapsed=Math.max(0,time-(scene?.time||0)),next=scenes.slice(index+1).find(s=>s.time!==null),length=next?Math.max(1,next.time!-(scene?.time||0)):14,p=Math.min(1,elapsed/length);
 const motion=scene?.motion||'still',transform=motion==='zoom-in'?`scale(${1.02+p*.09})`:motion==='pan-left'?`scale(1.12) translateX(${3-p*6}%)`:motion==='pan-right'?`scale(1.12) translateX(${-3+p*6}%)`:motion==='drift'?`scale(1.1) translate(${Math.sin(p*2)*1.5}%,${Math.cos(p*2)*1.5}%)`:'none';
 return <div className="rx-story-stage" role="group" aria-label="پلان‌های مصور همراه روایت" onContextMenu={e=>e.preventDefault()} onDragStart={e=>e.preventDefault()}><div className="rx-story-screen" data-effect={scene?.effect||'none'} style={{'--story-play':playing?'running':'paused'} as CSSProperties}>
 <div className="rx-story-image" style={{transform}}>{url&&failed!==url?<ReaderPageCanvas key={url} url={url} label={`تصویر پلان ${index+1}: ${scene?.title||page.heading}`} onError={()=>setFailed(url)}/>:<div className="rx-story-empty">تصویر این پلان هنوز آماده نشده است.</div>}</div><div className="rx-story-actor" data-motion={scene?.actorMotion||'breathe'} style={{animationPlayState:playing?'running':'paused'}}>{foreground&&<ReaderPageCanvas key={foreground} url={foreground} label="شخصیت متحرک روایت" onError={()=>{}}/>}</div><div className="rx-story-weather" aria-hidden="true"/><ReaderAccountStamp code={page.protection?.watermark}/>
 <span className="rx-story-number">پلان {(index+1).toLocaleString('fa-IR')} از {scenes.length.toLocaleString('fa-IR')}</span></div>
 <nav className="rx-story-scenes" aria-label="انتخاب پلان روایت">{scenes.map((s,i)=><button type="button" key={s.id} className={i===index?'is-active':''} aria-current={i===index?'step':undefined} title={s.title+(s.time===null?'؛ زمان گفتار هنوز تطبیق نشده':'')} onClick={()=>{if(s.time!==null&&onSeek)onSeek(s.time);if(!playing)setManual(s.id);}}>{(i+1).toLocaleString('fa-IR')}</button>)}</nav>
 {scenes.some(s=>s.time===null)&&<small className="rx-story-pending">تعویض خودکار فقط برای پلان‌های دارای تطبیق گفتار فعال است.</small>}</div>;
}
