import {useEffect,useRef,useState} from 'react';
import {ImageReadingLine} from '../utils/pageLineFocus';
export function ReaderLineFocus({line}:{line:ImageReadingLine|null}){
 const root=useRef<HTMLDivElement>(null),[box,setBox]=useState({left:0,top:0,width:0,height:0});
 useEffect(()=>{const parent=root.current?.parentElement,source=parent?.querySelector<HTMLCanvasElement>('.reader-page-canvas');if(!parent||!source)return;const measure=()=>{const w=parent.clientWidth,h=parent.clientHeight,scale=Math.min(w/source.width,h/source.height),width=source.width*scale,height=source.height*scale;setBox({left:(w-width)/2,top:(h-height)/2,width,height});};measure();const resize=new ResizeObserver(measure);resize.observe(parent);const pixels=new MutationObserver(measure);pixels.observe(source,{attributes:true,attributeFilter:['width','height','aria-busy']});return()=>{resize.disconnect();pixels.disconnect();};},[line]);
 return <div ref={root} className="rx-line-layer" style={{...box,right:'auto',bottom:'auto'}} aria-hidden="true">{line&&<span className="rx-image-reading-line" style={{left:`${line.x*100}%`,top:`${line.y*100}%`,width:`${line.width*100}%`,height:`${line.height*100}%`}}/>}</div>;
}
