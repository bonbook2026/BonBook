import {createContext,ReactNode,useContext,useEffect,useRef,useState} from 'react';
import {AudioCue,LibraryBook,LibraryPage} from '../types';
import {api,mediaUrl} from '../services/api';
import {cueOffset,readingLines} from '../utils/narration';
import {BookAudioQueue,recordedPages} from '../utils/bookAudioQueue';
export interface NarrationTarget{bookId:number;number:number;title:string;content:string;language:string;audioUrl:string|null;audioCues?:AudioCue[];audioCueMode?:string;page?:LibraryPage}
interface BookPlayback{bookId:number;index:number;total:number;completed:boolean}
interface NarrationState{target:NarrationTarget|null;status:'idle'|'loading'|'playing'|'paused';mode:'page'|'book';playlist:BookPlayback|null;error:string|null;rate:number;position:number;offset:number;approximate:boolean;elapsedSeconds:number;durationSeconds:number}
function useNarrationState(){
 const [state,setState]=useState<NarrationState>({target:null,status:'idle',mode:'page',playlist:null,error:null,rate:1,position:0,offset:-1,approximate:false,elapsedSeconds:0,durationSeconds:0});
 const generation=useRef(0),audio=useRef<HTMLAudioElement|null>(null),current=useRef(state),queue=useRef<BookAudioQueue<NarrationTarget>|null>(null),bookPaused=useRef(false);current.current=state;
 const publish=(patch:Partial<NarrationState>)=>{const next={...current.current,...patch};current.current=next;setState(next);};
 const halt=()=>{generation.current++;if(audio.current){audio.current.onended=null;audio.current.ontimeupdate=null;audio.current.onseeked=null;audio.current.onloadedmetadata=null;audio.current.onerror=null;audio.current.pause();}window.speechSynthesis?.cancel();};
 const stop=()=>{queue.current?.stop();queue.current=null;bookPaused.current=false;halt();if(audio.current){audio.current.removeAttribute('src');audio.current.load();}publish({status:'idle',mode:'page',playlist:null,position:0,offset:-1,error:null,elapsedSeconds:0,durationSeconds:0});};
 const startTarget=(target:NarrationTarget,rate:number,bookPlayback:BookPlayback|null=null,ended?:()=>void,paused=false)=>{
  halt();const revision=generation.current;
  publish({target,status:paused?'paused':'playing',mode:bookPlayback?'book':'page',playlist:bookPlayback,error:null,rate,position:0,offset:-1,elapsedSeconds:0,durationSeconds:0,approximate:Boolean(target.audioUrl&&(!target.audioCues?.length||target.audioCueMode==='PARTIAL'))});
  const fail=(error?:unknown)=>{const name=(error as {name?:string})?.name;if(name==='AbortError'&&current.current.status==='paused')return;if(generation.current===revision)publish({status:'paused',offset:-1,error:name==='NotAllowedError'?'برای ادامهٔ صدا، دکمهٔ پخش را بزن.':'پخش این ویس انجام نشد؛ دوباره پخش کن یا ویس بعدی را انتخاب کن.'});};
  if(target.audioUrl){
   // Keep one media element across tracks so the user's playback permission and
   // speed survive automatic page changes, including on mobile browsers.
   const player=audio.current||new Audio();audio.current=player;player.src=target.audioUrl;player.defaultPlaybackRate=rate;player.playbackRate=rate;
   player.onended=()=>{if(generation.current!==revision)return;if(ended)ended();else publish({status:'idle',position:100,offset:-1});};
   const sync=()=>{if(Number.isFinite(player.duration)&&player.duration>0&&generation.current===revision){const fraction=player.currentTime/player.duration;publish({position:fraction*100,elapsedSeconds:player.currentTime,durationSeconds:player.duration,offset:target.audioCues?.length?cueOffset(target.audioCues,player.currentTime):Math.floor(fraction*target.content.length)});}};
   player.ontimeupdate=sync;player.onseeked=sync;player.onloadedmetadata=()=>{player.playbackRate=current.current.rate;sync();};player.onerror=()=>fail();if(!paused)void player.play().catch(fail);return;
  }
  if(!('speechSynthesis'in window)){publish({status:'idle',error:'این مرورگر خواندن متن با صدا را پشتیبانی نمی‌کند.'});return;}
  const parts=readingLines(target.content);let index=0;
  const next=()=>{if(generation.current!==revision)return;if(index>=parts.length){publish({status:'idle',position:100,offset:-1});return;}
   const part=parts[index],speech=new SpeechSynthesisUtterance(part.text);speech.lang=target.language||'fa-IR';speech.rate=rate;
   const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(speech.lang.slice(0,2).toLowerCase()));if(voice)speech.voice=voice;
   speech.onstart=()=>{if(generation.current===revision)publish({offset:part.start,position:part.start/target.content.length*100});};
   speech.onboundary=event=>{if(generation.current===revision)publish({offset:part.start+event.charIndex,position:(part.start+event.charIndex)/target.content.length*100});};
   speech.onend=()=>{index++;next();};
   speech.onerror=event=>{if(generation.current===revision&&event.error!=='interrupted'&&event.error!=='canceled')publish({status:'idle',offset:-1,error:'صدای این زبان در مرورگر در دسترس نیست. از فایل صوتی کتاب یا مرورگر دیگری استفاده کن.'});};
   window.speechSynthesis.speak(speech);
  };next();
 };
 const play=(target:NarrationTarget,rate=current.current.rate)=>{stop();startTarget(target,rate);};
 const playBook=(book:LibraryBook)=>{
  stop();publish({target:null});const pages=recordedPages(book.pages||[]);if(!pages.length){publish({error:'این کتاب هنوز ویس ضبط‌شده ندارد.'});return;}
  const playback=new BookAudioQueue<NarrationTarget>(pages,{
   load:async number=>{const {page}=await api.library.page(book.id,number),url=mediaUrl(page.audioUrl);return url?{bookId:book.id,number,title:book.title,content:page.content,language:book.language,audioUrl:url,audioCues:page.audioCues,audioCueMode:page.audioCueMode,page}:null;},
   loading:(index,total)=>{halt();publish({status:bookPaused.current?'paused':'loading',mode:'book',playlist:{bookId:book.id,index,total,completed:false},error:null,offset:-1,position:0,elapsedSeconds:0,durationSeconds:0});},
   play:(target,index,total)=>{startTarget(target,current.current.rate,{bookId:book.id,index,total,completed:false},()=>{if(queue.current===playback)void playback.next();},bookPaused.current);},
   complete:played=>{halt();publish({status:'idle',position:100,offset:-1,playlist:{bookId:book.id,index:Math.max(0,pages.length-1),total:pages.length,completed:true},error:played?null:'ویس قابل پخشی در این کتاب در دسترس نیست.'});},
   error:(_error,number)=>{halt();publish({status:'paused',error:`دریافت ویس صفحهٔ ${number.toLocaleString('fa-IR')} انجام نشد؛ دوباره پخش کن یا ویس بعدی را بزن.`});}
  });queue.current=playback;void playback.start();
 };
 const pause=()=>{bookPaused.current=true;audio.current?.pause();window.speechSynthesis?.pause();publish({status:'paused'});};
 const resume=()=>{
  bookPaused.current=false;
  if(queue.current?.loading){publish({status:'loading'});return;}
  if(queue.current&&current.current.error&&current.current.target?.number!==queue.current.pages[queue.current.index]){void queue.current.retry();return;}
  const revision=generation.current;
  if(current.current.target?.audioUrl&&audio.current){if(audio.current.error)audio.current.load();void audio.current.play().then(()=>{if(generation.current===revision&&!bookPaused.current)publish({status:'playing',error:null});}).catch(error=>{if(generation.current===revision&&!(error?.name==='AbortError'&&current.current.status==='paused'))publish({status:'paused',error:'ادامهٔ پخش انجام نشد؛ دوباره دکمهٔ پخش را بزن.'});});}
  else{window.speechSynthesis?.resume();publish({status:'playing',error:null});}
 };
 const seek=(percent:number)=>{const player=audio.current;if(!current.current.target?.audioUrl||!player||!Number.isFinite(player.duration))return;player.currentTime=Math.max(0,Math.min(100,percent))/100*player.duration;player.ontimeupdate?.call(player,new Event('timeupdate'));};
 const setRate=(rate:number)=>{publish({rate});if(current.current.target?.audioUrl&&audio.current)audio.current.playbackRate=rate;else if(current.current.target&&['playing','paused'].includes(current.current.status))play(current.current.target,rate);};
 const nextBook=()=>{void queue.current?.next();},previousBook=()=>{void queue.current?.previous();},jumpBook=(number:number)=>{void queue.current?.jump(number);};
 useEffect(()=>()=>{queue.current?.stop();generation.current++;if(audio.current){audio.current.pause();audio.current.removeAttribute('src');audio.current.load();}window.speechSynthesis?.cancel();},[]);
 return {...state,play,playBook,pause,resume,stop,setRate,seek,nextBook,previousBook,jumpBook};
}
const Context=createContext<ReturnType<typeof useNarrationState>|null>(null);
export function NarrationProvider({children}:{children:ReactNode}){const value=useNarrationState();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useNarration(){const value=useContext(Context);if(!value)throw new Error('NarrationProvider is required');return value;}
