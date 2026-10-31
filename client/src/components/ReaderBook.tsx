import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {LibraryPage} from '../types';
import {mediaUrl} from '../services/api';
import {ReaderAccountStamp} from './ReaderProtection';
import {ReaderPageCanvas} from './ReaderPageCanvas';
import {ImageReadingLine,ImageReadingWord,bookFocusTransform,hitImageLine,hitImageWord} from '../utils/pageLineFocus';
import {ReaderLineFocus} from './ReaderLineFocus';

export function readerPageImage(page:LibraryPage){
  return page.visualMode==='TEXT'?null:mediaUrl(page.imageUrl||page.sourceImageUrl||null);
}

export function ReaderSheet({page,title,large=false,line=null,word=null,wordMode=false}:{page:LibraryPage;title:string;large?:boolean;line?:ImageReadingLine|null;word?:ImageReadingWord|null;wordMode?:boolean}){
  const url=readerPageImage(page),[failed,setFailed]=useState<string|null>(null);
  return url&&failed!==url?<><ReaderPageCanvas key={url} url={url} label={`${title}، تصویر صفحهٔ ${page.number.toLocaleString('fa-IR')}`} onError={()=>setFailed(url)}/><ReaderLineFocus line={line} word={word} wordMode={wordMode}/></>:
    <div className={'rx-text-page'+(large?' rx-text-page-large':'')}>
      <span className="rx-text-page-title">{title}</span><h2>{page.heading||`صفحهٔ ${page.number.toLocaleString('fa-IR')}`}</h2>
      <p>{page.content||'این صفحه متنی ندارد.'}</p><span className="rx-text-page-number">{page.number.toLocaleString('fa-IR')}</span>
      <ReaderAccountStamp code={page.protection?.watermark}/>
      {url&&failed===url&&<small>تصویر بارگذاری نشد؛ می‌توانی متن این صفحه را بخوانی.</small>}
    </div>;
}

interface SpreadProps{page:LibraryPage;facing:LibraryPage|null;hasFacing:boolean;title:string;single:boolean;activeOnLeft?:boolean;onZoom:()=>void;onFacing:()=>void;zoomLabel?:string;focusLine?:ImageReadingLine|null;eye?:boolean;lines?:ImageReadingLine[];onReadLine?:(line:ImageReadingLine)=>void;focusWord?:ImageReadingWord|null;words?:ImageReadingWord[];facingWords?:ImageReadingWord[];facingLines?:ImageReadingLine[];onReadWord?:(word:ImageReadingWord|null,page:LibraryPage)=>void}
export function ReaderBook({page,facing,hasFacing,title,single,activeOnLeft=false,onZoom,onFacing,zoomLabel='بزرگ‌نمایی صفحهٔ جاری',focusLine=null,eye=false,lines=[],onReadLine,focusWord=null,words,facingWords,facingLines=[],onReadWord}:SpreadProps){
  const pointer=useRef<{x:number;y:number;word:ImageReadingWord|null;line:ImageReadingLine|null;number:number}|null>(null);
  const canceled=useRef(false),leftActive=activeOnLeft&&!single;
  const hit=(element:HTMLButtonElement,x:number,y:number,wordList:ImageReadingWord[]|undefined,lineList:ImageReadingLine[])=>{const canvas=element.querySelector<HTMLCanvasElement>('.reader-page-canvas');if(!canvas||canvas.width<2)return {word:null,line:null};const box=canvas.getBoundingClientRect(),scale=Math.min(box.width/canvas.width,box.height/canvas.height),width=canvas.width*scale,height=canvas.height*scale,u=(x-box.left-(box.width-width)/2)/width,v=(y-box.top-(box.height-height)/2)/height;return {word:wordList?hitImageWord(wordList,u,v):null,line:hitImageLine(lineList,u,v)};};
  const interaction=(target:LibraryPage,wordList:ImageReadingWord[]|undefined,lineList:ImageReadingLine[],fallback:()=>void)=>({
   onPointerDown:(event:{clientX:number;clientY:number;currentTarget:HTMLButtonElement})=>{canceled.current=false;pointer.current={x:event.clientX,y:event.clientY,number:target.number,...hit(event.currentTarget,event.clientX,event.clientY,wordList,lineList)};},
   onPointerCancel:()=>{pointer.current=null;canceled.current=true;},
   onClick:(event:{clientX:number;clientY:number;currentTarget:HTMLButtonElement;detail:number})=>{const start=pointer.current;pointer.current=null;if(event.detail&&(canceled.current||start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>12))return;if(event.detail){const selected=start?.number===target.number?start:hit(event.currentTarget,event.clientX,event.clientY,wordList,lineList);if(onReadWord&&readerPageImage(target)){onReadWord(selected.word,target);return;}if(selected.line&&onReadLine&&target.number===page.number){onReadLine(selected.line);return;}}if(target.number!==page.number&&onReadWord){onReadWord(null,target);return;}fallback();},
  });
  const stage=useRef<HTMLDivElement>(null),[visibleFraction,setVisibleFraction]=useState(1);
  useLayoutEffect(()=>{const element=stage.current,parent=element?.parentElement;if(!eye||!element||!parent)return;const measure=()=>setVisibleFraction(Math.min(1,parent.clientHeight/Math.max(1,element.clientHeight)));measure();const resize=new ResizeObserver(measure);resize.observe(element);resize.observe(parent);return()=>resize.disconnect();},[eye,single]);
  const right=leftActive&&facing?facing:page,left=leftActive?page:facing;
  const previous=useRef<{page:LibraryPage;facing:LibraryPage|null;single:boolean}|null>(null);
  const [turn,setTurn]=useState<{direction:'next'|'previous';front:LibraryPage;back:LibraryPage}|null>(null);
  useLayoutEffect(()=>{
    const old=previous.current;
    if(!old||old.single!==single||old.page.bookId!==right.bookId||old.page.number===right.number||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const forward=right.number>old.page.number;
    setTurn({direction:forward?'next':'previous',front:forward&&!single?(old.facing||old.page):old.page,back:right});
    const timer=window.setTimeout(()=>setTurn(null),720);return()=>window.clearTimeout(timer);
  },[right.bookId,right.number,single]);
  useEffect(()=>{previous.current={page:right,facing:left,single};},[right,left,single]);
  return <div ref={stage} className={'rx-book-stage'+(single?' rx-single':'')+(leftActive?' rx-active-left':'')+(eye?' rx-eye-focus':'')} onContextMenu={event=>event.preventDefault()} onDragStart={event=>event.preventDefault()}><div className="rx-book-object" style={eye?{transformOrigin:'0 0',transform:bookFocusTransform(single,focusLine,visibleFraction,leftActive)}:undefined}>
    <div className="rx-book-edge" aria-hidden="true"/><div className="rx-book-spread">
      <button type="button" className="rx-paper-page rx-current-page" data-page-number={page.number} aria-label={zoomLabel} title={onReadWord?'هر کلمه را لمس کن تا روایت از همان کلمه پخش شود':lines.length?'هر خط را لمس کن تا روایت از همان‌جا پخش شود':undefined} {...interaction(page,words,lines,onZoom)}><ReaderSheet page={page} title={title} line={focusLine} word={focusWord} wordMode={Boolean(words?.some(word=>word.time!==undefined&&word.endTime!==undefined))}/><span className="rx-paper-sheen"/></button>
      <button type="button" className="rx-paper-page rx-facing-page" data-page-number={facing?.number} aria-label={facing&&onReadWord?`متن صفحهٔ ${facing.number.toLocaleString('fa-IR')}؛ لمس کلمه برای پخش`:hasFacing?'رفتن به صفحهٔ روبه‌رو':'پایان کتاب'} disabled={!hasFacing||!facing&&Boolean(onReadWord)} title={onReadWord?'هر کلمه را لمس کن تا روایت از همان کلمه پخش شود':undefined} {...(facing?interaction(facing,facingWords,facingLines,onFacing):{onClick:onFacing})}>
        {facing?<ReaderSheet page={facing} title={title}/>:<div className="rx-end-page"><span>✳</span><strong>{hasFacing?'صفحهٔ بعد':'هر پایان، یک آغاز تازه.'}</strong><small dir="ltr">BonBook</small></div>}<span className="rx-paper-sheen"/>
      </button>
    </div><span className="rx-spine-shadow" aria-hidden="true"/>
    {turn&&<div key={`${page.number}-${turn.direction}`} className={`rx-turning-leaf rx-turn-${turn.direction}`} aria-hidden="true"><div className="rx-leaf-front"><ReaderSheet page={turn.front} title={title}/></div><div className="rx-leaf-back"><ReaderSheet page={turn.back} title={title}/></div></div>}
  </div></div>;
}
