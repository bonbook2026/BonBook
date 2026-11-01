import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {config} from '../config';

export interface SpeechQueueJob{id:string;bookId:number;pageNumber:number;status:string;progress:number}
export interface SpeechWorkerState{heartbeat:number;lastBookId:number|null;active:{id:string;bookId:number;pageNumber:number;progress:number;startedAt:number}|null}
const stateFile=()=>path.resolve(config.mediaDirectory,'../speech-worker.json');

// Rotate between books, retaining FIFO within each book. One large import must
// not prevent every other book from starting for hours.
export function fairSpeechOrder<T extends {bookId:number}>(jobs:T[],lastBookId:number|null):T[]{
 const groups=new Map<number,T[]>();for(const job of jobs){const group=groups.get(job.bookId)||[];group.push(job);groups.set(job.bookId,group);}
 const books=[...groups.keys()],result:T[]=[];let index=lastBookId===null?0:books.indexOf(lastBookId)+1;
 if(index>=books.length)index=0;
 while(result.length<jobs.length){const book=books[index],group=groups.get(book)!;if(group.length)result.push(group.shift()!);index=(index+1)%books.length;}
 return result;
}
export async function readSpeechWorkerState():Promise<SpeechWorkerState|null>{try{
 const state=JSON.parse(await fs.readFile(stateFile(),'utf8'));
 if(!Number.isFinite(state.heartbeat)||!(state.lastBookId===null||Number.isSafeInteger(state.lastBookId)))return null;
 return state;
}catch{return null;}}
export async function writeSpeechWorkerState(state:SpeechWorkerState){
 const file=stateFile(),temporary=file+'.'+crypto.randomUUID()+'.tmp';
 try{await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});await fs.writeFile(temporary,JSON.stringify(state),{mode:0o600});await fs.rename(temporary,file);}finally{await fs.unlink(temporary).catch(()=>{});}
}
export function speechQueueSnapshot(jobs:SpeechQueueJob[],state:SpeechWorkerState|null,bookId:number,now=Date.now()){
 const active=jobs.find(job=>job.status==='PROCESSING')||null;
 const waiting=fairSpeechOrder(jobs.filter(job=>job.status==='QUEUED'),active?.bookId??state?.lastBookId??null);
 const ordered=active?[active,...waiting]:waiting,positions=new Map(ordered.map((job,index)=>[job.id,index+1]));
 return {online:Boolean(state&&now-state.heartbeat<45000&&state.heartbeat>0),active:active?{...active,startedAt:state?.active?.id===active.id?state.active.startedAt:null}:null,pending:ordered.length,nextPosition:ordered.findIndex(job=>job.bookId===bookId)+1,positions};
}
