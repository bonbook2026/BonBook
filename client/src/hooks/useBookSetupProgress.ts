import {useEffect,useRef,useState} from 'react';
import {api} from '../services/api';
import {BookSetupProgress} from '../types';

export function useBookSetupProgress(bookId?:number){
 const [data,setData]=useState<BookSetupProgress|null>(null),[error,setError]=useState(''),[checking,setChecking]=useState(false),refreshRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  setData(null);setError('');setChecking(false);if(!bookId)return;
  let live=true,busy=false,again=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
  const refresh=async()=>{
   if(!live||document.hidden)return;if(busy){again=true;return;}busy=true;setChecking(true);
   controller=new AbortController();
   try{const result=await api.admin.setupProgress(bookId,controller.signal);if(live){setData(result.progress);setError('');}}
   catch(error){if(live&&!(error instanceof DOMException&&error.name==='AbortError'))setError(error instanceof Error?error.message:'وضعیت کتاب دریافت نشد.');}
   finally{busy=false;if(live){setChecking(false);if(again){again=false;timer=setTimeout(()=>void refresh(),200);}}}
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),200);};
  refreshRef.current=()=>void refresh();
  window.addEventListener('bonbook:admin-saved',schedule);window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',schedule);
  const interval=setInterval(()=>void refresh(),15000);void refresh();
  return()=>{live=false;controller?.abort();clearTimeout(timer);clearInterval(interval);refreshRef.current=()=>{};window.removeEventListener('bonbook:admin-saved',schedule);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',schedule);};
 },[bookId]);
 return {progress:error?null:data,error,checking,refresh:()=>refreshRef.current()};
}
