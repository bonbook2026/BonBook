import {useEffect,useMemo,useRef} from 'react';
import {readingLines} from '../utils/narration';
function Highlight({text,terms}:{text:string;terms:string[]}){
  const escaped=terms.filter(Boolean).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!escaped.length)return <>{text}</>;
  const regex=new RegExp(`(${escaped.join('|')})`,'gi');
  return <>{text.split(regex).map((part,index)=>terms.some(term=>term.toLowerCase()===part.toLowerCase())?<mark key={index}>{part}</mark>:part)}</>;
}
export function ReadAlongText({text,offset,follow,terms}:{text:string;offset:number;follow:boolean;terms:string[]}){
  const lines=useMemo(()=>readingLines(text),[text]),root=useRef<HTMLDivElement>(null);
  const active=offset<0?-1:lines.findIndex((line,index)=>offset>=line.start&&(index===lines.length-1||offset<lines[index+1].start));
  useEffect(()=>{if(!follow||active<0)return;const element=root.current?.querySelector('[aria-current="true"]');if(!element)return;const box=element.getBoundingClientRect();if(box.top<100||box.bottom>window.innerHeight-160)element.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[active,follow]);
  const paragraphs=[...new Set(lines.map(line=>line.paragraph))];
  return <div className="reader-prose read-along-text" ref={root}>{paragraphs.map(paragraph=><p key={paragraph}>{lines.map((line,index)=>line.paragraph===paragraph?<span key={line.start} className={'read-line'+(index===active?' is-reading':'')} aria-current={index===active?'true':undefined}><Highlight text={line.text} terms={terms}/>{' '}</span>:null)}</p>)}</div>;
}
