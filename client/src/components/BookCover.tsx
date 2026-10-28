import { useEffect, useState } from 'react';
import { LibraryBook } from '../types';
import { mediaUrl } from '../services/api';
import { CoverSettings, coverRegions } from '../utils/cover';
type CoverBook=Pick<LibraryBook,'title'|'author'|'coverUrl'|'coverTone'>&CoverSettings;
export function BookCover({book,small=false,interactive=false,imageUrl}:{book:CoverBook;small?:boolean;interactive?:boolean;imageUrl?:string}){
  const cover=imageUrl||mediaUrl(book.coverUrl),spread=book.coverLayout==='SPREAD';
  const [flipped,setFlipped]=useState(false),[dimensions,setDimensions]=useState({src:'',ratio:1.5});
  useEffect(()=>setFlipped(false),[cover,book.coverFrontSide,book.coverLayout]);
  const ratio=dimensions.src===cover?dimensions.ratio:1.5,regions=coverRegions(book);
  const face=(side:'front'|'back',className='')=><span className={`reading-cover tone-${book.coverTone}${small?' is-small':''}${cover?' has-image':''} ${className}`}>
    {cover?spread?<svg viewBox={`${regions[side].start*ratio} 0 ${(regions[side].end-regions[side].start)*ratio} 1`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${side==='front'?'روی':'پشت'} جلد ${book.title}`}><image href={cover} x={0} y={0} width={ratio} height={1} preserveAspectRatio="none"/></svg>:<img src={cover} alt={`روی جلد ${book.title}`} loading="lazy"/>:<><span className="cover-brand" dir="ltr">BONBOOK / EDITIONS</span><span className="cover-ornament" aria-hidden="true">✳</span><strong>{book.title}</strong><span className="cover-author">{book.author||'کتابخانهٔ بون‌بوک'}</span><span className="cover-bottom" dir="ltr">READ. LISTEN. DISCOVER.</span></>}
  </span>;
  const measurement=cover&&spread?<img className="cover-measurement" src={cover} alt="" aria-hidden="true" onLoad={event=>{const img=event.currentTarget;if(img.naturalHeight)setDimensions({src:cover,ratio:img.naturalWidth/img.naturalHeight});}}/>:null;
  return interactive&&spread&&cover?<div className="cover-turntable">{measurement}<button type="button" className="cover-flip" aria-label={`${flipped?'نمایش روی جلد':'نمایش پشت جلد'} ${book.title}`} aria-pressed={flipped} onClick={()=>setFlipped(!flipped)}><span className={`cover-flip-inner${flipped?' is-flipped':''}`}>{face('front','cover-face-front')}{face('back','cover-face-back')}</span></button><span className="cover-flip-caption" aria-hidden="true">{flipped?'پشت جلد · لمس کن تا رو را ببینی':'روی جلد · لمس کن تا پشت را ببینی'} <span>↶</span></span></div>:<>{measurement}{face('front')}</>;
}
