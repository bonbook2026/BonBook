import {KeyboardEvent,PointerEvent,useEffect,useRef,useState} from 'react';
import {journeySeek,readingJourney} from '../utils/readingJourney';

interface JourneyControl{position:number;total:number;enabled:boolean;scope:number;onSeek:(position:number)=>Promise<void>;onStart:()=>void;onCancel:()=>void}
export function useReaderJourney(options:JourneyControl){
 const latest=useRef(options);latest.current=options;
 const orbit=useRef<HTMLDivElement>(null),holding=useRef(false),draft=useRef(options.position),revision=useRef(0),mounted=useRef(true);
 const [preview,setPreview]=useState<number|null>(null),[dragging,setDragging]=useState(false),[busy,setBusy]=useState(false),[trail,setTrail]=useState<{x:number;y:number}[]>([]),[error,setError]=useState('');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;revision.current++;if(holding.current){holding.current=false;latest.current.onCancel();}};},[]);
 useEffect(()=>{revision.current++;setPreview(null);setBusy(false);setDragging(false);setTrail([]);if(holding.current){holding.current=false;latest.current.onCancel();}},[options.enabled,options.scope]);
 const commit=(value:number)=>{
  const token=++revision.current;setPreview(value);setBusy(true);setError('');
  void latest.current.onSeek(value).catch(()=>{if(mounted.current&&revision.current===token)setError('جابه‌جایی روایت انجام نشد؛ دوباره انتخاب کن.');}).finally(()=>{if(mounted.current&&revision.current===token){setBusy(false);setPreview(null);}});
 };
 const cancel=()=>{if(!holding.current)return;holding.current=false;setDragging(false);setPreview(null);setTrail([]);latest.current.onCancel();};
 const onPointerDown=(event:PointerEvent)=>{
  if(!latest.current.enabled||!latest.current.total||event.button!==0)return;
  event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);holding.current=true;revision.current++;draft.current=preview??latest.current.position;setPreview(draft.current);setBusy(false);setDragging(true);setTrail([]);latest.current.onStart();
 };
 const onPointerMove=(event:PointerEvent)=>{
  if(!holding.current||!orbit.current)return;
  const bounds=orbit.current.getBoundingClientRect(),progress=Math.min(1,Math.max(0,((event.clientX-bounds.left)/bounds.width-.08)/.84));
  const value=journeySeek(progress,latest.current.total),state=readingJourney(value,latest.current.total);draft.current=value;setPreview(value);setTrail(old=>[...old.slice(-22),{x:state.x*10,y:state.y*2.2}]);
 };
 const onPointerUp=(event:PointerEvent)=>{if(!holding.current)return;holding.current=false;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setDragging(false);setTrail([]);commit(draft.current);};
 const onPointerCancel=(event:PointerEvent)=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);cancel();};
 const onKeyDown=(event:KeyboardEvent)=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();if(event.repeat||!latest.current.enabled||!latest.current.total)return;
  const step=event.shiftKey?10:1,current=preview??latest.current.position,value=event.key==='Home'?0:event.key==='End'?latest.current.total:Math.max(0,Math.min(latest.current.total,current+(event.key==='ArrowRight'?step:-step)));
  commit(value);
 };
 return {position:preview??options.position,dragging,busy,trail,error,orbit,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onLostPointerCapture:cancel,onKeyDown};
}
