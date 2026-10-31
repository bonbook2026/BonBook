import {useEffect,useState} from 'react';
import {api} from '../services/api';
import {LibraryPage,PageLineMap} from '../types';
export function usePageLineMap(page:LibraryPage|null,enabled:boolean){
 const [value,setValue]=useState<{key:string;map:PageLineMap}|null>(null),key=page?`${page.bookId}/${page.number}/${page.updatedAt}`:'';
 useEffect(()=>{
  if(!page||!enabled||page.visualMode==='IMAGE'||page.visualMode==='TEXT'||!page.content||!(page.imageUrl||page.sourceImageUrl))return;
  let live=true,timer:ReturnType<typeof setTimeout>,attempts=0;const controller=new AbortController();
  const read=async()=>{try{const result=await api.library.lineMap(page.bookId,page.number,controller.signal);if(!live)return;if(result.pageUpdatedAt!==page.updatedAt){setValue({key,map:{status:'unavailable',lines:[],coverage:0,message:'صفحه تغییر کرده است؛ برای همراهی خط‌ها دوباره صفحه را باز کن.'}});return;}setValue({key,map:result.map});if(result.map.status==='processing'&&++attempts<45)timer=setTimeout(()=>void read(),4000);}catch{if(live)setValue({key,map:{status:'unavailable',lines:[],coverage:0,message:'همراهی روی تصویر فعلاً آماده نیست؛ زیرنویس همچنان در دسترس است.'}});}};
  void read();return()=>{live=false;controller.abort();clearTimeout(timer);};
 },[key,enabled]);
 return value?.key===key?value.map:null;
}
