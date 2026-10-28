import {useEffect,useMemo,useRef,useState} from 'react';
import {api} from '../services/api';
import {AudioCue} from '../types';
import {readingLines} from '../utils/narration';
export function AudioCueEditor({id,text,cues,onChange}:{id:string;text:string;cues:AudioCue[];onChange:(cues:AudioCue[])=>void}){
  const [url,setUrl]=useState(''),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState('');
  const player=useRef<HTMLAudioElement>(null),lines=useMemo(()=>readingLines(text),[text]);
  useEffect(()=>{let active=true,objectUrl='';setUrl('');setError('');setTime(0);setDuration(0);void api.admin.mediaBlob(id).then(blob=>{objectUrl=URL.createObjectURL(blob);if(active)setUrl(objectUrl);else URL.revokeObjectURL(objectUrl);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;player.current?.pause();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[id]);
  const mark=(offset:number,value:number|null)=>{setError('');const next=cues.filter(cue=>cue.offset!==offset);if(value!==null)next.push({offset,time:value});next.sort((a,b)=>a.offset-b.offset);if(next.some((cue,index)=>cue.time<0||!Number.isFinite(cue.time)||(duration>0&&cue.time>duration)||(index>0&&cue.time<=next[index-1].time))){setError('زمان هر خط باید بعد از خط قبلی و قبل از خط بعدی باشد و از طول فایل بیشتر نشود.');return;}onChange(next);};
  return <details className="audio-cue-editor"><summary>هماهنگ‌کردن خط‌های متن با ویس</summary><p>ویس را پخش کن؛ با شروع خواندن هر خط، «شروع این خط در همین لحظه» را بزن. زمان‌ها قابل اصلاح هستند. سپس «ذخیرهٔ صفحه» را بزن.</p><p>بدون زمان‌بندی، همراهی متن تقریبی است. با تغییر متن یا تعویض ویس، زمان‌های قبلی پاک می‌شوند.</p>
  {url&&<audio ref={player} controls preload="metadata" src={url} onLoadedMetadata={e=>setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:0)} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}/>}
  <span className="cue-clock">زمان پخش: {time.toLocaleString('fa-IR',{maximumFractionDigits:1})} ثانیه</span>
  {error&&<p className="notice error" role="alert">{error}</p>}
  <div className="cue-lines">{lines.map((line,index)=>{const cue=cues.find(c=>c.offset===line.start);return <div className={'cue-line'+(cue?' timed':'')} key={line.start}><b>{(index+1).toLocaleString('fa-IR')}</b><span>{line.text}</span><label>شروع (ثانیه)<input type="number" min={0} max={duration||86400} step="0.1" aria-label={'زمان شروع خط '+(index+1)} value={cue?.time??''} onChange={e=>mark(line.start,e.target.value===''?null:Number(e.target.value))}/></label><button type="button" className="reader-button" disabled={!url} onClick={()=>mark(line.start,Math.round((player.current?.currentTime||0)*10)/10)}>شروع این خط در همین لحظه</button>{cue&&<button type="button" aria-label={'شنیدن خط '+(index+1)} onClick={()=>{if(player.current){player.current.currentTime=cue.time;void player.current.play().catch(()=>setError('دکمهٔ پخش فایل را بزن.'));}}}>▶</button>}</div>;})}</div>
  <small>{cues.length.toLocaleString('fa-IR')} خط زمان‌بندی شده از {lines.length.toLocaleString('fa-IR')} خط</small></details>;
}
