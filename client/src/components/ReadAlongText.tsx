import {useEffect,useMemo,useRef} from 'react';
import {readingLines} from '../utils/narration';
function Highlight({text,terms}:{text:string;terms:string[]}){
  const escaped=terms.filter(Boolean).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!escaped.length)return <>{text}</>;
  const regex=new RegExp(`(${escaped.join('|')})`,'gi');
  return <>{text.split(regex).map((part,index)=>terms.some(term=>term.toLowerCase()===part.toLowerCase())?<mark key={index}>{part}</mark>:part)}</>;
}
export function ReadAlongText({text,offset,follow,terms,captions=false,contained=false,captionLength=72}:{text:string;offset:number;follow:boolean;terms:string[];captions?:boolean;contained?:boolean;captionLength?:number}){
  const lines=useMemo(()=>readingLines(text,captions?captionLength:160),[text,captions,captionLength]),root=useRef<HTMLDivElement>(null);
  const active=offset<0?-1:lines.findIndex((line,index)=>offset>=line.start&&(index===lines.length-1||offset<lines[index+1].start));
  useEffect(()=>{if(!follow||active<0||captions)return;const element=root.current?.querySelector('[aria-current="true"]');if(!element)return;const box=element.getBoundingClientRect(),behavior=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';if(contained&&root.current){const parent=root.current,parentBox=parent.getBoundingClientRect();if(box.top<parentBox.top+8||box.bottom>parentBox.bottom-8)parent.scrollTo({top:parent.scrollTop+box.top-parentBox.top-parent.clientHeight/2+box.height/2,behavior});}else if(box.top<100||box.bottom>window.innerHeight-160)element.scrollIntoView({block:'center',behavior});},[active,follow,captions,contained]);
  const paragraphs=[...new Set(lines.map(line=>line.paragraph))];
  const selected=captions?Math.max(0,active):active;
  return <div className={'reader-prose read-along-text'+(captions?' rx-captions':'')} ref={root}>{paragraphs.map(paragraph=><p key={paragraph}>{lines.map((line,index)=>line.paragraph===paragraph?<span key={line.start} className={'read-line'+(index===selected?' is-reading':'')+(captions&&index===selected+1?' is-next':'')} aria-current={index===active?'true':undefined}><Highlight text={line.text} terms={terms}/>{' '}</span>:null)}</p>)}</div>;
}
