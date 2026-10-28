import {createContext,ReactNode,useContext,useEffect,useRef,useState} from 'react';
import {AudioCue} from '../types';
import {cueOffset,readingLines} from '../utils/narration';
export interface NarrationTarget{bookId:number;number:number;title:string;content:string;language:string;audioUrl:string|null;audioCues?:AudioCue[];audioCueMode?:string}
interface NarrationState{target:NarrationTarget|null;status:'idle'|'playing'|'paused';error:string|null;rate:number;position:number;offset:number;approximate:boolean}
function useNarrationState(){
  const [state,setState]=useState<NarrationState>({target:null,status:'idle',error:null,rate:1,position:0,offset:-1,approximate:false});
  const generation=useRef(0),audio=useRef<HTMLAudioElement|null>(null),current=useRef(state);current.current=state;
  const stop=()=>{generation.current++;audio.current?.pause();audio.current=null;window.speechSynthesis?.cancel();setState(s=>({...s,status:'idle',position:0,offset:-1}));};
  const play=(target:NarrationTarget,rate=current.current.rate)=>{
    stop();const revision=generation.current;setState({target,status:'playing',error:null,rate,position:0,offset:-1,approximate:Boolean(target.audioUrl&&(!target.audioCues?.length||target.audioCueMode==='PARTIAL'))});
    const fail=()=>{if(generation.current===revision)setState(s=>({...s,status:'idle',offset:-1,error:'پخش صوت انجام نشد. دوباره دکمهٔ پخش را بزنید.'}));};
    if(target.audioUrl){const player=new Audio(target.audioUrl);audio.current=player;player.playbackRate=rate;
      player.onended=()=>{if(generation.current===revision)setState(s=>({...s,status:'idle',position:100,offset:-1}));};
      const sync=()=>{if(Number.isFinite(player.duration)&&player.duration>0&&generation.current===revision){const fraction=player.currentTime/player.duration;setState(s=>({...s,position:fraction*100,offset:target.audioCues?.length?cueOffset(target.audioCues,player.currentTime):Math.floor(fraction*target.content.length)}));}};
      player.ontimeupdate=sync;player.onseeked=sync;player.onloadedmetadata=sync;player.onerror=fail;player.play().catch(fail);return;
    }
    if(!('speechSynthesis'in window)){setState(s=>({...s,status:'idle',error:'این مرورگر خواندن متن با صدا را پشتیبانی نمی‌کند.'}));return;}
    const parts=readingLines(target.content);let index=0;
    const next=()=>{if(generation.current!==revision)return;if(index>=parts.length){setState(s=>({...s,status:'idle',position:100,offset:-1}));return;}
      const part=parts[index],speech=new SpeechSynthesisUtterance(part.text);speech.lang=target.language||'fa-IR';speech.rate=rate;
      const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(speech.lang.slice(0,2).toLowerCase()));if(voice)speech.voice=voice;
      speech.onstart=()=>{if(generation.current===revision)setState(s=>({...s,offset:part.start,position:part.start/target.content.length*100}));};
      speech.onboundary=event=>{if(generation.current===revision)setState(s=>({...s,offset:part.start+event.charIndex,position:(part.start+event.charIndex)/target.content.length*100}));};
      speech.onend=()=>{index++;next();};
      speech.onerror=event=>{if(generation.current===revision&&event.error!=='interrupted'&&event.error!=='canceled')setState(s=>({...s,status:'idle',offset:-1,error:'صدای این زبان در مرورگر در دسترس نیست. از فایل صوتی کتاب یا مرورگر دیگری استفاده کنید.'}));};
      window.speechSynthesis.speak(speech);
    };next();
  };
  const pause=()=>{audio.current?.pause();window.speechSynthesis?.pause();setState(s=>({...s,status:'paused'}));};
  const seek=(percent:number)=>{const player=audio.current;if(!player||!Number.isFinite(player.duration))return;player.currentTime=Math.max(0,Math.min(100,percent))/100*player.duration;player.ontimeupdate?.call(player,new Event('timeupdate'));};
  const resume=()=>{if(audio.current){void audio.current.play().then(()=>setState(s=>({...s,status:'playing'}))).catch(()=>setState(s=>({...s,error:'ادامهٔ پخش انجام نشد.'})));}else{window.speechSynthesis?.resume();setState(s=>({...s,status:'playing'}));}};
  const setRate=(rate:number)=>{setState(s=>({...s,rate}));if(audio.current)audio.current.playbackRate=rate;else if(current.current.target&&current.current.status!=='idle')play(current.current.target,rate);};
  useEffect(()=>()=>{generation.current++;audio.current?.pause();window.speechSynthesis?.cancel();},[]);
  return {...state,play,pause,resume,stop,setRate,seek};
}
const Context=createContext<ReturnType<typeof useNarrationState>|null>(null);
export function NarrationProvider({children}:{children:ReactNode}){const value=useNarrationState();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useNarration(){const value=useContext(Context);if(!value)throw new Error('NarrationProvider is required');return value;}
