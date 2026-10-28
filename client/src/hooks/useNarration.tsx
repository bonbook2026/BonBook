import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
export interface NarrationTarget { bookId:number; number:number; title:string; content:string; language:string; audioUrl:string|null }
interface NarrationState { target:NarrationTarget|null; status:'idle'|'playing'|'paused'; error:string|null; rate:number; position:number }
function chunks(text:string){return text.match(/[^.!؟\n]+[.!؟\n]*/g)?.flatMap(part=>part.match(/.{1,220}(?:\s|$)|.{1,220}/g)||[])||[text];}
function useNarrationState(){
  const [state,setState]=useState<NarrationState>({target:null,status:'idle',error:null,rate:1,position:0});
  const generation=useRef(0),audio=useRef<HTMLAudioElement|null>(null),current=useRef(state);current.current=state;
  const stop=()=>{generation.current++;audio.current?.pause();audio.current=null;window.speechSynthesis?.cancel();setState(s=>({...s,status:'idle',position:0}));};
  const play=(target:NarrationTarget,rate=current.current.rate)=>{
    stop();const revision=generation.current;setState({target,status:'playing',error:null,rate,position:0});
    if(target.audioUrl){const player=new Audio(target.audioUrl);audio.current=player;player.playbackRate=rate;
      player.onended=()=>{if(generation.current===revision)setState(s=>({...s,status:'idle',position:100}));};
      player.ontimeupdate=()=>{if(player.duration&&generation.current===revision)setState(s=>({...s,position:player.currentTime/player.duration*100}));};
      player.play().catch(()=>{if(generation.current===revision)setState(s=>({...s,status:'idle',error:'پخش صوت انجام نشد. دوباره دکمهٔ پخش را بزنید.'}));});return;}
    if(!('speechSynthesis'in window)){setState(s=>({...s,status:'idle',error:'این مرورگر خواندن متن با صدا را پشتیبانی نمی‌کند.'}));return;}
    const parts=chunks(target.content);let index=0;
    const next=()=>{if(generation.current!==revision)return;if(index>=parts.length){setState(s=>({...s,status:'idle',position:100}));return;}
      const speech=new SpeechSynthesisUtterance(parts[index]);speech.lang=target.language||'fa-IR';speech.rate=rate;
      const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(speech.lang.slice(0,2).toLowerCase()));if(voice)speech.voice=voice;
      speech.onend=()=>{index++;if(generation.current===revision){setState(s=>({...s,position:index/parts.length*100}));next();}};
      speech.onerror=event=>{if(generation.current===revision&&event.error!=='interrupted'&&event.error!=='canceled')setState(s=>({...s,status:'idle',error:'صدای این زبان در مرورگر در دسترس نیست. از فایل صوتی کتاب یا مرورگر دیگری استفاده کنید.'}));};
      window.speechSynthesis.speak(speech);};next();
  };
  const pause=()=>{audio.current?.pause();window.speechSynthesis?.pause();setState(s=>({...s,status:'paused'}));};
  const resume=()=>{if(audio.current)void audio.current.play();else window.speechSynthesis?.resume();setState(s=>({...s,status:'playing'}));};
  const setRate=(rate:number)=>{setState(s=>({...s,rate}));if(audio.current)audio.current.playbackRate=rate;else if(current.current.target&&current.current.status!=='idle')play(current.current.target,rate);};
  useEffect(()=>()=>{generation.current++;audio.current?.pause();window.speechSynthesis?.cancel();},[]);
  return {...state,play,pause,resume,stop,setRate};
}
const Context=createContext<ReturnType<typeof useNarrationState>|null>(null);
export function NarrationProvider({children}:{children:ReactNode}){const value=useNarrationState();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useNarration(){const value=useContext(Context);if(!value)throw new Error('NarrationProvider is required');return value;}
