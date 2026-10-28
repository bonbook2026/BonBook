import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { BookCover } from '../components/BookCover';
import { Icon } from '../components/Icon';
import { api } from '../services/api';
import { LibraryBook } from '../types';
import { useAuth } from '../hooks/useAuth';

export function Library(){
  const [books,setBooks]=useState<LibraryBook[]>([]),[category,setCategory]=useState('همه'),[query,setQuery]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[resume,setResume]=useState<{book:LibraryBook;pageNumber:number}|null>(null);
  const {user}=useAuth(),navigate=useNavigate();
  useEffect(()=>{let active=true;api.library.list().then(result=>{if(active){setBooks(result.books);setLoading(false);}}).catch(e=>{if(active){setError(e.message);setLoading(false);}});return()=>{active=false;};},[]);
  useEffect(()=>{if(user)void api.library.progress().then(result=>setResume(result.progress[0]||null)).catch(()=>{});},[user?.id]);
  const categories=['همه',...new Set(books.map(b=>b.category))],filtered=books.filter(b=>category==='همه'||b.category===category);
  return <Layout wide><section className="library-hero">
    <div className="library-hero-copy"><span className="library-kicker"><span/> کمی از شلوغی فاصله بگیر</span><h1>داستان بعدی‌ات را<br/><em>زندگی کن.</em></h1><p>بخوان، به صدای کتاب گوش بده،<br/>و هر موضوعی را میان صفحه‌ها پیدا کن.</p><form className="library-search" onSubmit={e=>{e.preventDefault();if(query.trim())navigate('/search?q='+encodeURIComponent(query.trim()));}}><Icon name="search" className="w-5 h-5"/><input aria-label="موضوعی در کتاب‌ها پیدا کن" value={query} onChange={e=>setQuery(e.target.value)} placeholder="دربارهٔ چه چیزی می‌خواهی بخوانی؟"/><button type="submit" aria-label="جست‌وجو"><Icon name="arrow" className="w-5 h-5"/></button></form></div>
    <div className="library-hero-art" aria-hidden="true"><div className="hero-reading-disc"/><div className="hero-type-book"><small dir="ltr">BONBOOK</small><span>یک فصل<br/>برای خودت</span><i>✳</i><small>بخوان. بشنو. کشف کن.</small></div><div className="hero-audio-note"><Icon name="headphones" className="w-5 h-5"/><span>کتاب‌ها صدایت می‌زنند</span><b>▂ ▅ ▃ ▆ ▂</b></div></div>
  </section>
  {resume&&<Link className="continue-reading" to={`/read/${resume.book.id}/${resume.pageNumber}`}><span className="continue-icon"><Icon name="book"/></span><div><small>از همان‌جا که بودی</small><strong>{resume.book.title}</strong></div><span>ادامهٔ صفحهٔ {resume.pageNumber.toLocaleString('fa-IR')}</span><Icon name="arrow" className="w-5 h-5"/></Link>}
  <section className="library-shelf"><div className="library-section-heading"><div><span className="shop-eyebrow">فصل تازهٔ تو</span><h2>میان کتاب‌ها قدم بزن</h2></div><span className="shelf-count">{books.length.toLocaleString('fa-IR')} عنوان برای خواندن</span></div>
  <div className="category-tabs" aria-label="دسته‌بندی کتاب‌ها">{categories.map(item=><button key={item} aria-pressed={category===item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</div>
  {loading?<div className="reading-loading" role="status">کتابخانه در حال آماده‌شدن است…</div>:error?<p role="alert" className="notice error">{error}</p>:!filtered.length?<div className="reading-empty"><Icon name="book" className="w-12 h-12"/><h3>این قفسه منتظر کتاب است</h3><p>کتاب‌های منتشرشده از اینجا در دسترس قرار می‌گیرند.</p>{user?.role&&['OWNER','ADMIN'].includes(user.role)&&<Link className="reader-button primary" to="/admin">ساخت اولین کتاب</Link>}</div>:<div className="library-grid">{filtered.map(book=><article className="library-book-card" key={book.id}><div className="book-cover-stage">{book.coverLayout==='SPREAD'&&book.coverUrl?<BookCover book={book} interactive/>:<Link to={`/read/${book.id}/0`} aria-label={`خواندن ${book.title}`}><BookCover book={book}/></Link>}</div><div className="book-card-meta"><span>{book.category}</span><span>{book.pageCount.toLocaleString('fa-IR')} صفحه</span></div><h3><Link to={`/read/${book.id}/0`}>{book.title}</Link></h3><p>{book.author||'کتابخانهٔ بون‌بوک'}</p>{book.isSample&&<small className="sample-label">نمونهٔ آموزشی</small>}<Link className="book-read-link" to={`/read/${book.id}/0`}><Icon name="play" className="w-4 h-4"/>بخوان و بشنو<Icon name="arrow" className="w-4 h-4"/></Link></article>)}</div>}
  </section>
  <section className="reading-invitation"><Icon name="headphones" className="w-9 h-9"/><div><h2>گاهی فقط گوش بده.</h2><p>هر صفحه یک دکمهٔ پخش دارد. متن را بخوان یا همراه صدایش پیش برو.</p></div><Link to="/search" className="reader-button">موضوعت را پیدا کن <Icon name="arrow" className="w-4 h-4"/></Link></section>
  </Layout>;
}
