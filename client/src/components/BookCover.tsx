import { LibraryBook } from '../types';
import { mediaUrl } from '../services/api';
export function BookCover({book,small=false}:{book:Pick<LibraryBook,'title'|'author'|'coverUrl'|'coverTone'>;small?:boolean}){
  const cover=mediaUrl(book.coverUrl);
  return <div className={`reading-cover tone-${book.coverTone}${small?' is-small':''}`}>
    {cover?<img src={cover} alt={`جلد کتاب ${book.title}`} loading="lazy"/>:<><span className="cover-brand" dir="ltr">BONBOOK / EDITIONS</span><span className="cover-ornament" aria-hidden="true">✳</span><strong>{book.title}</strong><span className="cover-author">{book.author||'کتابخانهٔ بون‌بوک'}</span><span className="cover-bottom" dir="ltr">READ. LISTEN. DISCOVER.</span></>}
  </div>;
}
