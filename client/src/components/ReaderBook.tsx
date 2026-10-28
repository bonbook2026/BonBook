import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {LibraryPage} from '../types';
import {mediaUrl} from '../services/api';

export function readerPageImage(page:LibraryPage){
  return page.visualMode==='TEXT'?null:mediaUrl(page.imageUrl||page.sourceImageUrl||null);
}

export function ReaderSheet({page,title,large=false}:{page:LibraryPage;title:string;large?:boolean}){
  const url=readerPageImage(page),[failed,setFailed]=useState<string|null>(null);
  return url&&failed!==url?<img src={url} alt={`${title}، تصویر صفحهٔ ${page.number.toLocaleString('fa-IR')}`} onError={()=>setFailed(url)} decoding="async"/>:
    <div className={'rx-text-page'+(large?' rx-text-page-large':'')}>
      <span className="rx-text-page-title">{title}</span><h2>{page.heading||`صفحهٔ ${page.number.toLocaleString('fa-IR')}`}</h2>
      <p>{page.content||'این صفحه متنی ندارد.'}</p><span className="rx-text-page-number">{page.number.toLocaleString('fa-IR')}</span>
      {url&&failed===url&&<small>تصویر بارگذاری نشد. متن و فایل اصلی در دسترس‌اند.</small>}
    </div>;
}

interface SpreadProps{page:LibraryPage;facing:LibraryPage|null;hasFacing:boolean;title:string;single:boolean;onZoom:()=>void;onFacing:()=>void}
export function ReaderBook({page,facing,hasFacing,title,single,onZoom,onFacing}:SpreadProps){
  const previous=useRef<{page:LibraryPage;facing:LibraryPage|null}|null>(null);
  const [turn,setTurn]=useState<{direction:'next'|'previous';front:LibraryPage;back:LibraryPage}|null>(null);
  useLayoutEffect(()=>{
    const old=previous.current;
    if(!old||old.page.bookId!==page.bookId||old.page.number===page.number||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const forward=page.number>old.page.number;
    setTurn({direction:forward?'next':'previous',front:forward&&!single?(old.facing||old.page):old.page,back:page});
    const timer=window.setTimeout(()=>setTurn(null),720);return()=>window.clearTimeout(timer);
  },[page.bookId,page.number]);
  useEffect(()=>{previous.current={page,facing};},[page,facing]);
  return <div className={'rx-book-stage'+(single?' rx-single':'')}><div className="rx-book-object">
    <div className="rx-book-edge" aria-hidden="true"/><div className="rx-book-spread">
      <button type="button" className="rx-paper-page rx-current-page" aria-label="بزرگ‌نمایی صفحهٔ جاری" onClick={onZoom}><ReaderSheet page={page} title={title}/><span className="rx-paper-sheen"/></button>
      <button type="button" className="rx-paper-page rx-facing-page" aria-label={hasFacing?'رفتن به صفحهٔ روبه‌رو':'پایان کتاب'} disabled={!hasFacing} onClick={onFacing}>
        {facing?<ReaderSheet page={facing} title={title}/>:<div className="rx-end-page"><span>✳</span><strong>{hasFacing?'صفحهٔ بعد':'هر پایان، یک آغاز تازه.'}</strong><small dir="ltr">BonBook</small></div>}<span className="rx-paper-sheen"/>
      </button>
    </div><span className="rx-spine-shadow" aria-hidden="true"/>
    {turn&&<div key={`${page.number}-${turn.direction}`} className={`rx-turning-leaf rx-turn-${turn.direction}`} aria-hidden="true"><div className="rx-leaf-front"><ReaderSheet page={turn.front} title={title}/></div><div className="rx-leaf-back"><ReaderSheet page={turn.back} title={title}/></div></div>}
  </div></div>;
}
