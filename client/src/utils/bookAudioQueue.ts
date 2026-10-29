export function recordedPages(pages:{number:number;hasAudio?:boolean}[]){return [...new Set(pages.filter(page=>page.hasAudio).map(page=>page.number))].sort((a,b)=>a-b);}
export interface BookQueueCallbacks<T>{load:(number:number)=>Promise<T|null>;loading:(index:number,total:number)=>void;play:(target:T,index:number,total:number)=>void;complete:(played:number)=>void;error:(error:unknown,number:number)=>void}
// The queue contains recordings only. Null loads handle audio removed after the
// book was opened; stale requests never restart playback after stop or a jump.
export class BookAudioQueue<T>{
 private revision=0;private active=false;private played=0;
 index=-1;loading=false;
 constructor(readonly pages:number[],private callbacks:BookQueueCallbacks<T>){}
 start(fromNumber?:number){this.active=true;this.played=0;const index=fromNumber===undefined?0:this.pages.findIndex(number=>number>=fromNumber);return this.move(index<0?this.pages.length:index);}
 stop(){this.active=false;this.loading=false;this.revision++;}
 next(){return this.active?this.move(this.index+1):Promise.resolve();}
 previous(){return this.active?this.move(Math.max(0,this.index-1)):Promise.resolve();}
 retry(){return this.active?this.move(Math.max(0,this.index)):Promise.resolve();}
 jump(number:number){const index=this.pages.findIndex(page=>page>=number);return this.active&&index>=0?this.move(index):Promise.resolve();}
 private async move(index:number){
  const revision=++this.revision;this.loading=true;
  while(this.active&&revision===this.revision&&index<this.pages.length){
   this.index=index;this.callbacks.loading(index,this.pages.length);
   try{const target=await this.callbacks.load(this.pages[index]);if(!this.active||revision!==this.revision)return;
    if(target===null){index++;continue;}
    this.loading=false;this.played++;this.callbacks.play(target,index,this.pages.length);return;
   }catch(error){if(this.active&&revision===this.revision){this.loading=false;this.callbacks.error(error,this.pages[index]);}return;}
  }
  if(this.active&&revision===this.revision){this.active=false;this.loading=false;this.callbacks.complete(this.played);}
 }
}
