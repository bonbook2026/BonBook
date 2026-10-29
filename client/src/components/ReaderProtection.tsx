import {useEffect} from 'react';
/** These are casual-copy deterrents; access control and image stamping live on the server. */
export function useReaderProtection(){
 useEffect(()=>{
  const protectedTarget=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('.rx-book-stage,.rx-immersive-caption,.rx-immersive-transcript,.rx-transcript-card');
  const block=(event:Event)=>{if(protectedTarget(event.target))event.preventDefault();};
  const copy=(event:ClipboardEvent)=>{const selection=window.getSelection();if(protectedTarget(event.target)||protectedTarget(selection?.anchorNode?.parentElement||null))event.preventDefault();};
  document.addEventListener('contextmenu',block);document.addEventListener('dragstart',block);document.addEventListener('copy',copy);document.addEventListener('cut',copy);
  return()=>{document.removeEventListener('contextmenu',block);document.removeEventListener('dragstart',block);document.removeEventListener('copy',copy);document.removeEventListener('cut',copy);};
 },[]);
}
export function ReaderAccountStamp({code}:{code?:string}){return code?<span className="reader-account-stamp" aria-label="شناسهٔ نسخهٔ شخصی" dir="ltr">BonBook · {code}</span>:null;}
