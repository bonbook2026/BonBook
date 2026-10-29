import {CSSProperties} from 'react';
export function ReaderAtmosphere({night,moving,animals=true}:{night:boolean;moving:boolean;animals?:boolean}){
 return <div className={`reader-atmosphere ${night?'atmosphere-night':'atmosphere-day'}${moving?'':' atmosphere-still'}`} aria-hidden="true">
 {night?<><div className="atmosphere-nebula nebula-violet"/><div className="atmosphere-nebula nebula-blue"/><div className="atmosphere-galaxy"/><div className="atmosphere-moon"><i/><i/><i/></div><div className="atmosphere-planet"/>
 <div className="atmosphere-stars">{Array.from({length:48},(_,index)=><i key={index} style={{'--star-x':`${(index*37+11)%100}%`,'--star-y':`${(index*23+7)%92}%`,'--star-size':`${index%5===0?3:1.5}px`,'--star-delay':`${index%9*-1.1}s`,'--star-duration':`${4+index%7}s`} as CSSProperties}/>)}</div>
 {[0,1,2].map(index=><div key={index} className="atmosphere-meteor" style={{'--meteor-delay':`${index*7+2}s`,'--meteor-top':`${10+index*23}%`,'--meteor-left':`${24+index*24}%`} as CSSProperties}/>)}</>:<>
 <div className="atmosphere-sun"><i/></div><div className="atmosphere-cloud cloud-one"/><div className="atmosphere-cloud cloud-two"/><div className="atmosphere-hill hill-far"/><div className="atmosphere-hill hill-near"/><div className="atmosphere-breeze breeze-one"/><div className="atmosphere-breeze breeze-two"/>
 {animals&&[0,1,2].map(index=><svg className={`atmosphere-bird bird-${index}`} key={index} viewBox="0 0 80 28"><path d="M4 16 Q22 0 40 18 Q58 0 76 16"/></svg>)}
 {animals&&[0,1,2].map(index=><div className={`atmosphere-butterfly butterfly-${index}`} key={index}><svg viewBox="0 0 60 46"><g className="butterfly-left"><path d="M30 27C-1-6-8 13 5 27c-9 22 14 17 25 0Z"/></g><g className="butterfly-right"><path d="M30 27C61-6 68 13 55 27c9 22-14 17-25 0Z"/></g><path className="butterfly-body" d="M30 16v23m0-20-5-8m5 8 5-8"/></svg></div>)}
 <div className="atmosphere-grass">{Array.from({length:28},(_,index)=><i key={index} style={{'--grass-x':`${index/27*100}%`,'--grass-height':`${40+(index*19)%85}px`,'--grass-delay':`${index%7*-.7}s`,'--grass-angle':`${index%2?14:-13}deg`} as CSSProperties}/>)}</div>
 </>}<div className="atmosphere-vignette"/></div>;
}
