import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icon } from '../components/Icon';
import { api, mediaUrl } from '../services/api';
import { LibraryBook, LibraryPage } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useNarration } from '../hooks/useNarration';

function Highlight({text,terms}:{text:string;terms:string[]}){
  const escaped=terms.filter(Boolean).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!escaped.length)return <>{text}</>;
  const regex=new RegExp(`(${escaped.join('|')})`,'gi');
  return <>{text.split(regex).map((part,index)=>terms.some(term=>term.toLowerCase()===part.toLowerCase())?<mark key={index}>{part}</mark>:part)}</>;
}
export function Reader(){
  const params=useParams(),bookId=Number(params.bookId),number=Number(params.page),navigate=useNavigate(),location=useLocation();
  const [book,setBook]=useState<LibraryBook|null>(null),[page,setPage]=useState<LibraryPage|null>(null),[fontSize,setFontSize]=useState(21),[theme,setTheme]=useState('paper'),[error,setError]=useState(''),[toc,setToc]=useState(false);
  const {user}=useAuth(),audio=useNarration(),terms=(location.state as {highlight?:string[]}|null)?.highlight||[];
  const stopAudio=useRef(audio.stop);stopAudio.current=audio.stop;
  useEffect(()=>()=>stopAudio.current(),[]);
  useEffect(()=>{let active=true;setError('');setPage(null);api.library.book(bookId).then(async result=>{
    if(!active)return;setBook(result.book);
    if(number===0){let stored=0;try{stored=Number(localStorage.getItem(`bonbook_reading_${bookId}`));}catch{}const target=result.book.pages?.some(p=>p.number===stored)?stored:result.book.pages?.[0]?.number;if(target)navigate(`/read/${bookId}/${target}`,{replace:true});else setError('این کتاب هنوز صفحه‌ای ندارد.');return;}
    const response=await api.library.page(bookId,number);if(active){setPage(response.page);try{localStorage.setItem(`bonbook_reading_${bookId}`,String(number));}catch{}if(user)void api.library.saveProgress(bookId,number).catch(()=>{});}
  }).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[bookId,number,navigate,user?.id]);
  const active=audio.target?.bookId===bookId&&audio.target.number===number,index=book?.pages?.findIndex(p=>p.number===number)??-1;
  const go=(target:number)=>{audio.stop();setToc(false);navigate(`/read/${bookId}/${target}`);window.scrollTo({top:0,behavior:'smooth'});};
  const play=()=>{if(!page||!book)return;if(active&&audio.status==='playing')audio.pause();else if(active&&audio.status==='paused')audio.resume();else audio.play({bookId,number,title:book.title,content:page.content,language:book.language,audioUrl:mediaUrl(page.audioUrl)});};
  return <Layout wide><div className="reader-topline"><Link to="/library"><Icon name="arrow" className="w-4 h-4"/>کتابخانه</Link><span>{book?.category}</span><Link to={`/search?bookId=${bookId}`}><Icon name="search" className="w-4 h-4"/>جست‌وجو در این کتاب</Link></div>
  {error?<p className="notice error" role="alert">{error}</p>:!page||!book?<div className="reading-loading" role="status">در حال ورق‌زدن…</div>:<><div className="reader-book-heading"><span className="shop-eyebrow">{book.author}</span><h1>{book.title}</h1></div><div className="reader-controls"><button onClick={()=>setToc(!toc)} className="reader-button"><Icon name="orders" className="w-4 h-4"/>فهرست صفحه‌ها</button><div className="font-size-control" aria-label="اندازه متن"><button onClick={()=>setFontSize(Math.max(17,fontSize-2))} aria-label="کوچک‌تر کردن متن">آ−</button><span>متن</span><button onClick={()=>setFontSize(Math.min(29,fontSize+2))} aria-label="بزرگ‌تر کردن متن">آ+</button></div><div className="reader-themes" aria-label="رنگ صفحه">{['paper','cream','night'].map(t=><button key={t} className={`theme-${t}${theme===t?' selected':''}`} aria-label={t==='night'?'صفحه تیره':t==='cream'?'صفحه کرم':'صفحه روشن'} aria-pressed={theme===t} onClick={()=>setTheme(t)}/>)}</div></div>
  {toc&&<nav className="reader-toc" aria-label="فهرست کتاب">{book.pages?.map(item=><button className={item.number===number?'active':''} key={item.number} onClick={()=>go(item.number)}><span>{item.number.toLocaleString('fa-IR')}</span>{item.heading||'بدون عنوان'}</button>)}</nav>}
  <article className={`reader-paper theme-${theme}`} style={{fontSize}}><div className="reader-page-label">صفحهٔ {number.toLocaleString('fa-IR')}</div>{page.heading&&<h2>{page.heading}</h2>}<div className="reader-prose">{page.content.split(/\n\s*\n/).map((paragraph,i)=><p key={i}><Highlight text={paragraph} terms={terms}/></p>)}</div><span className="paper-end">✳</span></article>
  <div className="reader-audio-panel"><button className="audio-play" aria-label={active&&audio.status==='playing'?'مکث خواندن':'پخش این صفحه'} onClick={play}><Icon name={active&&audio.status==='playing'?'pause':'play'} className="w-6 h-6"/></button><div className="audio-caption"><strong>{active&&audio.status==='playing'?'دارم این صفحه را می‌خوانم…':active&&audio.status==='paused'?'خواندن متوقف شده':'این صفحه را بشنو'}</strong><span>{page.audioUrl?'روایت صوتی کتاب':'خواندن متن با صدای مرورگر'}</span><div className="audio-progress"><i style={{width:`${active?audio.position:0}%`}}/></div></div><label className="audio-rate"><span>سرعت</span><select aria-label="سرعت خواندن" value={audio.rate} onChange={e=>audio.setRate(Number(e.target.value))}>{[0.75,1,1.25,1.5].map(rate=><option key={rate} value={rate}>{rate}×</option>)}</select></label>{active&&audio.status!=='idle'&&<button className="audio-stop" onClick={audio.stop} aria-label="پایان پخش"><Icon name="stop" className="w-4 h-4"/></button>}</div>
  {active&&audio.error&&<p className="notice error" role="alert">{audio.error}</p>}
  <div className="reader-pagination"><button className="reader-button" disabled={index<=0} onClick={()=>go(book.pages![index-1].number)}><Icon name="arrow" className="w-4 h-4 rotate-180"/>صفحهٔ قبل</button><span>{(index+1).toLocaleString('fa-IR')} از {book.pageCount.toLocaleString('fa-IR')}</span><button className="reader-button primary" disabled={index>=book.pageCount-1} onClick={()=>go(book.pages![index+1].number)}>صفحهٔ بعد<Icon name="arrow" className="w-4 h-4"/></button></div></>}
  </Layout>;
}
