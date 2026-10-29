import {useState} from 'react';
/** Companions stay above the page edge, so they never cover book text. */
export function ReaderCompanion({night,moving,owlTone='gray',label}:{night:boolean;moving:boolean;owlTone?:'gray'|'white';label?:string}){
 const [reaction,setReaction]=useState(0);
 const white=owlTone==='white';
 return <button type="button" className={`rx-book-companion ${night?'companion-owl':'companion-sparrow'}${night&&white?' companion-white-owl':''}${moving?'':' companion-still'}`} aria-label={label||(night?'بازی با جغد':'بازی با گنجشک')} title="بزن تا بال بزنم" onClick={event=>{event.stopPropagation();if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)setReaction(value=>value+1);}}>
 <svg viewBox="0 0 120 108" fill="none" aria-hidden="true"><g key={reaction} className={reaction?'companion-reaction':undefined} onAnimationEnd={event=>{if(event.target===event.currentTarget)setReaction(0);}}>
 <ellipse cx="59" cy="104" rx="29" ry="3" fill={night?'#07101c':'#476146'} opacity=".16"/>
 {night?<>
 <path d="m49 81 10 18 12-18" fill={white?'#b0c2cf':'#555c72'}/>
 <g className="companion-body"><ellipse cx="59" cy="68" rx={white?33:29} ry={white?30:31} fill={white?'#e8eef1':'#6b7188'}/>
 <ellipse cx="59" cy="71" rx={white?21:18} ry="25" fill={white?'#fff9e9':'#c8c5be'}/>
 {[0,1,2].map(row=><g key={row} stroke="#9a9b9f" strokeWidth="1.5" strokeLinecap="round"><path d={`m49 ${62+row*9} 3 2 3-2m8 0 3 2 3-2`}/></g>)}
 <path className="companion-wing" d="M36 47c-12 9-12 30 1 39 7-15 10-30-1-39Z" fill={white?'#c9d8e1':'#4d536d'}/>
 <path d="M82 47c12 9 12 30-1 39-7-15-10-30 1-39Z" fill={white?'#c9d8e1':'#4d536d'}/>
 <path d="m32 60 6 6m-8 4 6 5m48-15-6 6m8 4-6 5" stroke="#87889b" strokeWidth="1.4" strokeLinecap="round"/>
 </g>
 <g className="companion-head"><path d="M28 30 27 6l20 12c8-3 18-3 26 0L93 6l-3 24c8 31-11 42-31 42S20 61 28 30Z" fill={white?'#f0f4f4':'#757b93'}/>
 <path d="m30 13 4 18 11-9Zm57 0-4 18-11-9Z" fill={white?'#d3dfe5':'#a3a5b4'}/>
 <path d="M59 28c-13-17-33-5-30 13 1 15 14 21 30 26 16-5 29-11 30-26 3-18-17-30-30-13Z" fill={white?'#fffdf3':'#e4dfd0'}/>
 <g className="companion-eyes"><ellipse cx="44" cy="40" rx="10" ry="12" fill="#a4956c"/><ellipse cx="74" cy="40" rx="10" ry="12" fill="#a4956c"/>
 <ellipse cx="44" cy="40" rx="7.5" ry="9" fill="#e4bf6c"/><ellipse cx="74" cy="40" rx="7.5" ry="9" fill="#e4bf6c"/>
 <ellipse cx="45" cy="40" rx="4" ry="7" fill="#263044"/><ellipse cx="73" cy="40" rx="4" ry="7" fill="#263044"/>
 <circle cx="46" cy="37" r="2" fill="#fff6db"/><circle cx="74" cy="37" r="2" fill="#fff6db"/></g>
 <path d="m55 49 4 10 4-10-4-3Z" fill="#c29d5d"/>
 <path d="m35 24 14 3m20 0 14-3" stroke="#62687f" strokeWidth="2" strokeLinecap="round"/></g>
 <path d="M48 97v7m-6 0 6-3 6 3m16-7v7m-6 0 6-3 6 3" stroke="#c7b48e" strokeWidth="3" strokeLinecap="round"/>
 </>:<g className="companion-hop">
 <g className="companion-tail"><path d="m35 63-24 1 22 19 17-4Z" fill="#705342"/><path d="m15 67 23 9" stroke="#c2a37d" strokeWidth="2" strokeLinecap="round"/></g>
 <path d="M49 89v10l-6 5m6-5 7 5m15-15v10l-6 5m6-5 7 5" stroke="#ad7955" strokeWidth="2.5" strokeLinecap="round"/>
 <g className="companion-body"><ellipse cx="59" cy="68" rx="31" ry="25" transform="rotate(-13 59 68)" fill="#ad8b64"/>
 <path d="M38 72c5 24 38 26 49 4l-9-22Z" fill="#efe7d8"/>
 <path className="companion-wing" d="M34 63c5-22 29-23 43-8-7 20-23 27-43 8Z" fill="#846349"/>
 <path d="m40 59 18 9m-13-17 20 10m-9-15 16 9" stroke="#c6a47a" strokeWidth="2" strokeLinecap="round"/></g>
 <g className="companion-head"><circle cx="77" cy="41" r="22" fill="#a37b53"/>
 <path d="M60 28c9-14 30-12 37 3l-8 6-16-3Z" fill="#77543f"/>
 <path d="M60 42c0 18 18 25 29 14l6-10-16-5Z" fill="#f4ecd9"/>
 <path d="m60 38 18 4 16-7" stroke="#e1c39a" strokeWidth="5" strokeLinecap="round"/>
 <path d="m93 41 15 5-15 5Z" fill="#af8a49"/>
 <path d="m79 54 8 4-10 5Z" fill="#584a3c"/>
 <g className="companion-eyes"><circle cx="84" cy="41" r="4" fill="#302f28"/><circle cx="85" cy="40" r="1.3" fill="#fffdf5"/></g></g>
 </g>}
 </g></svg></button>;
}
