import {useEffect,useRef,useState} from 'react';
import {paintPageCanvas} from '../utils/pageCanvas';

export function ReaderPageCanvas({url,label,onError}:{url:string;label:string;onError:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),failure=useRef(onError);
  const [ready,setReady]=useState(false);failure.current=onError;
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    const controller=new AbortController();setReady(false);
    void paintPageCanvas(element,url,controller.signal).then(()=>{
      if(!controller.signal.aborted)setReady(true);
    }).catch(()=>{if(!controller.signal.aborted)failure.current();});
    return()=>{controller.abort();element.width=1;element.height=1;};
  },[url]);
  return <canvas ref={canvas} className="reader-page-canvas" width={1} height={1} role="img" aria-label={label} aria-busy={!ready} draggable={false} onContextMenu={event=>event.preventDefault()}>{label}</canvas>;
}
