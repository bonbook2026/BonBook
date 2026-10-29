import {useEffect,useState} from 'react';

/** A book-edge companion. Explicit petting is independent of the ambient-motion switch. */
export function ReaderCat({moving,arrived}:{moving:boolean;arrived:boolean}){
 const [reaction,setReaction]=useState(0),[pose,setPose]=useState(arrived?'sitting':'walking');
 useEffect(()=>{
  const timers:number[]=[];
  if(reaction){setPose('affection');timers.push(window.setTimeout(()=>setPose(arrived?'sitting':'walking'),2400));if(arrived)timers.push(window.setTimeout(()=>setPose('sleeping'),6500));}
  else{setPose(arrived?'sitting':'walking');if(arrived)timers.push(window.setTimeout(()=>setPose('sleeping'),4000));}
  return()=>timers.forEach(window.clearTimeout);
 },[arrived,reaction]);
 return <button type="button" className={`rx-book-companion reader-cat cat-${pose}${moving?'':' cat-still'}`} data-pose={pose} aria-label="نوازش گربه" title="بزن تا بیدار شوم و ناز کنم" onClick={event=>{event.stopPropagation();setPose('affection');setReaction(value=>value+1);}}>
  <svg viewBox="0 0 160 132" fill="none" aria-hidden="true"><ellipse cx="85" cy="126" rx="52" ry="3" fill="#324e3d" opacity=".14"/>
   <g className="cat-walking-art" data-cat-art="walking"><path className="cat-walk-tail" d="M119 84c30-5 33-39 21-43" stroke="#ac977f" strokeWidth="12" strokeLinecap="round"/><ellipse cx="91" cy="88" rx="37" ry="24" fill="#c6b49b"/>
    {[64,80,104,119].map((x,index)=><path className={`cat-leg cat-leg-${index}`} key={x} d={`M${x} 101v20h-9`} stroke={index%2?'#b09c82':'#d5c6ac'} strokeWidth="10" strokeLinecap="round"/>)}
    <g className="cat-walk-head"><path d="m34 53-3-20 18 10m12 0 18-12-3 25" fill="#b8a388"/><path d="m36 48-1-9 9 7m22 0 8-9-1 12" fill="#e5b6aa"/><ellipse cx="54" cy="63" rx="25" ry="23" fill="#d5c3a6"/><path d="M33 70c5 21 36 20 44-2-16 7-27 5-44 2" fill="#f3e9d4"/><path d="m39 59 7-2m15 0 7 2" stroke="#504b3e" strokeWidth="3" strokeLinecap="round"/><path d="m50 67 5 4 5-4Z" fill="#b27f7c"/><path d="m55 71-3 5m3-5 4 5M33 70l-16-2m17 7-16 3m57-9 14-2m-14 7 15 3" stroke="#807461" strokeWidth="1.5" strokeLinecap="round"/></g>
   </g>
   <g key={reaction} className="cat-seated-art" data-cat-art="sitting"><path className="cat-tail" d="M112 109c45 11 42-26 25-28" stroke="#ad987e" strokeWidth="13" strokeLinecap="round"/><g className="cat-rub"><ellipse cx="94" cy="91" rx="28" ry="32" fill="#b9a48b"/><ellipse cx="91" cy="94" rx="18" ry="26" fill="#eadfc8"/><ellipse cx="113" cy="116" rx="18" ry="9" fill="#bfab90"/><path d="M77 92v29m22-29v29" stroke="#ddceb5" strokeWidth="11" strokeLinecap="round"/><path className="cat-offer-paw" d="M76 94q-8 13-21 6" stroke="#ddceb5" strokeWidth="10" strokeLinecap="round"/>
    <g className="cat-face"><path d="m67 46-1-24 21 14m17 0 19-15-2 27" fill="#b5a087"/><path d="m71 40-1-10 10 9m30-1 8-10-1 13" fill="#e5b8ac"/><ellipse cx="94" cy="54" rx="30" ry="26" fill="#d3c0a3"/><path d="M67 60c3 27 49 27 55 0-21 13-35 12-55 0Z" fill="#f3e9d4"/><path className="cat-eyes" d="m78 52 8 1m16 0 8-1" stroke="#4d4b3e" strokeWidth="3" strokeLinecap="round"/><path d="m89 61 5 4 5-4Z" fill="#b77e7c"/><path d="m94 65-3 5m3-5 4 5M70 62l-16-3m16 9-17 3m65-9 15-3m-15 9 16 3" stroke="#887966" strokeWidth="1.5" strokeLinecap="round"/><path d="m85 33 2 9m8-11v9m9-7-2 9" stroke="#ab957a" strokeWidth="3" strokeLinecap="round"/></g>
   </g><g className="cat-hearts" fill="#bc7d79"><path d="M50 43c-17-10-8-24 0-15 8-9 17 5 0 15Z"/><path d="M133 25c-13-8-6-18 0-12 6-6 13 4 0 12Z"/><path d="M108 13c-9-6-4-13 0-9 4-4 9 3 0 9Z"/></g></g>
   <g className="cat-sleeping-art" data-cat-art="sleeping"><g className="cat-sleep-breath"><ellipse cx="87" cy="108" rx="46" ry="18" fill="#c0ad92"/><path d="M114 100c44 16-9 34-57 19" stroke="#a68f74" strokeWidth="12" strokeLinecap="round"/><path d="m32 95-4-18 17 9m13 0 14-10-1 20" fill="#b7a186"/><ellipse cx="48" cy="105" rx="24" ry="18" fill="#dac9ac"/><path d="M27 110c6 16 35 16 43-1" fill="#f0e5ce"/><path d="m34 103 7 3 6-3m9 0 5 3 5-3" stroke="#6d6657" strokeWidth="2" strokeLinecap="round"/><path d="m47 111 4 3 4-3Z" fill="#bd8981"/></g><g className="cat-sleep-z" fill="#8a9c89" fontFamily="Georgia,serif" fontSize="13"><text x="64" y="78">z</text><text x="81" y="63" fontSize="17">z</text></g></g>
  </svg><span className="sr-only" role="status">{pose==='affection'?'گربه بیدار شد و با خوشحالی خودش را لوس می‌کند.':pose==='sleeping'?'گربه آرام خوابیده است.':pose==='walking'?'گربه به لبهٔ کتاب نزدیک می‌شود.':'گربه کنار کتاب نشسته است.'}</span>
 </button>;
}
