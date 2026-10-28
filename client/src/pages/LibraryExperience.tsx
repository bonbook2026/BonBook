import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Layout} from '../components/Layout';
import {BookCover} from '../components/BookCover';
import {Icon} from '../components/Icon';
import {LibraryHero,LibraryHeroControls} from '../components/LibraryHero';
import {api} from '../services/api';
import {LibraryBook} from '../types';
import {useAuth} from '../hooks/useAuth';
import {useTheme} from '../hooks/useTheme';
import {savedBookIds} from '../utils/library';
import {LibraryHeroSettings,defaultLibraryHero} from '../types/siteSettings';

function loadSaved(key:string){try{return savedBookIds(localStorage.getItem(key));}catch{return [];}}
const fa=(value:number)=>value.toLocaleString('fa-IR');
export function Library(){
  const {user}=useAuth(),{theme}=useTheme(),savedKey=`bonbook_saved_books_${user?.id||'guest'}`;
  const [books,setBooks]=useState<LibraryBook[]>([]),[category,setCategory]=useState<string|null>(null),[savedOnly,setSavedOnly]=useState(false),[saved,setSaved]=useState<number[]>(()=>loadSaved(savedKey));
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[resume,setResume]=useState<{book:LibraryBook;pageNumber:number}|null>(null);
  const hero=useRef<LibraryHeroControls>(null),[heroConfig,setHeroConfig]=useState<LibraryHeroSettings>(defaultLibraryHero);
  useEffect(()=>{let live=true;setLoading(true);setError('');void Promise.all([api.library.list(),api.site.hero()]).then(([result,appearance])=>{if(live){setHeroConfig(appearance.hero);setBooks(result.books);setLoading(false);}}).catch(error=>{if(live){setError(error.message);setLoading(false);}});return()=>{live=false;};},[retry]);
  useEffect(()=>{let live=true;setResume(null);if(user)void api.library.progress().then(result=>{if(live)setResume(result.progress[0]||null);}).catch(()=>{});return()=>{live=false;};},[user?.id]);
  useEffect(()=>{setSaved(loadSaved(savedKey));const sync=(event:StorageEvent)=>{if(event.key===savedKey)setSaved(savedBookIds(event.newValue));};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[savedKey]);
  const categories=[...new Set(books.map(book=>book.category).filter(Boolean))],filtered=books.filter(book=>(!category||book.category===category)&&(!savedOnly||saved.includes(book.id)));
  const featured=books.find(book=>book.id===resume?.book.id)||books[0]||null;
  const toggleSaved=(id:number)=>setSaved(current=>{const next=current.includes(id)?current.filter(value=>value!==id):[...current,id].slice(-1000);try{localStorage.setItem(savedKey,JSON.stringify(next));}catch{}return next;});
  return <Layout wide className="library-experience" footerText="کتاب‌ها تو را به دنیایی تازه دعوت می‌کنند.">
    <LibraryHero config={heroConfig} book={featured} resumeNumber={featured?.id===resume?.book.id?resume?.pageNumber:undefined} controls={hero}/>
    {resume&&books.some(book=>book.id===resume.book.id)&&<Link className="continue-card" to={`/read/${resume.book.id}/${resume.pageNumber}`}><span className="continue-icon"><Icon name="book"/></span><div><small>بعضی داستان‌ها منتظر برگشتن تو هستند</small><strong>{resume.book.title}</strong></div><div className="continue-progress"><span>ادامهٔ صفحهٔ {fa(resume.pageNumber)}</span><span className="progress-track"><i style={{width:`${Math.max(1,Math.min(100,resume.pageNumber/Math.max(1,resume.book.pageCount)*100))}%`}}/></span></div><Icon name="arrow" className="continue-arrow"/></Link>}
    <section className="shelf" id="library-shelf" aria-labelledby="library-shelf-title"><div className="shelf-heading"><div><span className="eyebrow">فصل تازهٔ تو</span><h2 id="library-shelf-title">میان کتاب‌ها،<br className="mobile-break"/> جهان تازه‌ای پیدا کن.</h2></div><span className="book-count">{fa(books.length)} عنوان برای کشف</span></div>
      <div className="shelf-toolbar"><div className="category-tabs" role="group" aria-label="دسته‌بندی کتابخانه"><button className={!category&&!savedOnly?'active':''} aria-pressed={!category&&!savedOnly} onClick={()=>{setCategory(null);setSavedOnly(false);}}>همه</button>{categories.map(value=><button key={value} className={category===value&&!savedOnly?'active':''} aria-pressed={category===value&&!savedOnly} onClick={()=>{setCategory(value);setSavedOnly(false);}}>{value}</button>)}<button className={savedOnly?'active':''} aria-pressed={savedOnly} onClick={()=>{setCategory(null);setSavedOnly(true);}}><Icon name="bookmark"/>نشان‌شده‌ها</button></div>{(category||savedOnly)&&<span className="lc-filter-count">{fa(filtered.length)} عنوان</span>}</div>
      {loading?<div className="lc-loading" role="status">کتابخانه در حال آماده‌شدن است…</div>:error?<div className="lc-library-error" role="alert"><p>{error}</p><button className="reader-button" onClick={()=>setRetry(value=>value+1)}>تلاش دوباره</button></div>:filtered.length?<div className={`lc-book-grid${filtered.length>1?' is-grid':''}`}>{filtered.map(book=><article className="featured-book" key={book.id}>
        <div className="real-cover-stage"><span className="cover-stage-ring" aria-hidden="true"/>{book.coverLayout==='SPREAD'&&book.coverUrl?<BookCover book={book} interactive/>:<Link to={`/read/${book.id}/0`} aria-label={`خواندن ${book.title}`}><BookCover book={book}/></Link>}</div>
        <div className="featured-copy"><div className="book-meta"><span><i/>{book.category}</span><button type="button" className="icon-button lc-save-book" aria-label={saved.includes(book.id)?`برداشتن نشان ${book.title}`:`نشان‌کردن ${book.title}`} aria-pressed={saved.includes(book.id)} onClick={()=>toggleSaved(book.id)}><Icon name="bookmark"/></button></div><h3><Link to={`/read/${book.id}/0`}>{book.title}</Link></h3><p className="book-author">{book.author||'کتابخانهٔ بون‌بوک'}</p>{book.description?<blockquote className="lc-book-description">{book.description}</blockquote>:<blockquote>کتاب‌ها تو را به دنیایی تازه دعوت می‌کنند.</blockquote>}<div className="book-details"><span><Icon name="book"/>{fa(book.pageCount)} صفحه</span><span><Icon name="headphones"/>بخوان و بشنو</span>{book.isSample&&<span>نمونهٔ آموزشی</span>}</div><Link className="read-book" to={`/read/${book.id}/0`}><Icon name="play"/>بخوان و بشنو<Icon name="arrow"/></Link></div>
      </article>)}</div>:<div className="empty-state"><Icon name="book"/><h3>{savedOnly?'این قفسه منتظر انتخاب توست.':'این قفسه منتظر کتاب است.'}</h3><p>{savedOnly?'با نشان‌کردن کتاب، اینجا راحت‌تر پیدایش می‌کنی.':'کتاب‌های منتشرشده از اینجا در دسترس قرار می‌گیرند.'}</p>{savedOnly||category?<button onClick={()=>{setSavedOnly(false);setCategory(null);}}>دیدن همهٔ کتاب‌ها <Icon name="arrow"/></button>:user?.role&&['OWNER','ADMIN'].includes(user.role)?<Link className="reader-button primary" to="/admin">ساخت اولین کتاب</Link>:null}</div>}
    </section>
    <section className="invitation"><div className="invitation-star" aria-hidden="true">{theme==='night'?'✦':<Icon name="sun"/>}</div><span className="eyebrow">یک دعوت ساده</span><h2>شاید یک کتاب، آغاز رؤیایی باشد<br/>که مدت‌هاست در انتظار بیدار شدن است.</h2>{heroConfig.audioMode!=='OFF'&&<button disabled={!featured&&heroConfig.audioMode==='AUTO'} onClick={()=>hero.current?.listen()}><Icon name="headphones"/>چشم‌ها را ببند، کمی گوش بده<Icon name="arrow"/></button>}</section>
  </Layout>;
}
