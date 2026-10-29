const clamp=(value:number,min=0,max=1)=>Math.min(max,Math.max(min,value));
export const smoothStep=(from:number,to:number,value:number)=>{const t=clamp((value-from)/(to-from));return t*t*(3-2*t);};
/** Position is pages read (including the fractional progress of the current page). */
export function readingJourney(position:number,total:number,startNight=false){
  const count=Math.max(1,total),padding=Math.min(2,Math.max(0,(count-1)/2));
  const progress=clamp((clamp(position,0,count)-padding)/Math.max(1,count-padding*2));
  const transition=smoothStep(0,1,progress),night=startNight?1-transition:transition;
  return {progress,night,dusk:Math.pow(Math.sin(Math.PI*progress),3),page:Math.min(count,Math.floor(clamp(position,0,count))+1),x:8+84*progress,y:67-32*Math.sin(Math.PI*progress),departure:smoothStep(.25,.56,progress),arrival:smoothStep(.58,.82,progress)};
}
/** Dragging is always physically left to right, regardless of the Persian UI direction. */
export function journeySeek(progress:number,total:number){
  const p=clamp(progress),count=Math.max(1,total),padding=Math.min(2,Math.max(0,(count-1)/2));
  return p===0?0:p===1?count:padding+p*(count-padding*2);
}
export function journeyReadingPosition(number:number,pages:{number:number}[],audioPercent=0){
  const index=pages.findIndex(page=>page.number===number);
  return index<0?0:index+clamp(audioPercent/100);
}
export function journeySeekTarget(position:number,pages:{number:number}[]){
  if(!pages.length)return null;
  const value=clamp(position,0,pages.length),index=Math.min(pages.length-1,Math.floor(value));
  // At the right edge, play the last page from its beginning rather than skipping its recording.
  return {number:pages[index].number,percent:value===pages.length?0:(value-index)*100};
}
// A compressed preview gives the first/last two pages three seconds each.
export const JOURNEY_PREVIEW_SECONDS=40;
export function journeyPosition(seconds:number,total:number){
  const time=clamp(seconds,0,JOURNEY_PREVIEW_SECONDS),padding=Math.min(2,(total-1)/2);
  if(time<3)return time/3*padding;
  if(time>37)return total-padding+(time-37)/3*padding;
  return padding+(time-3)/34*(total-padding*2);
}
export function journeySeconds(position:number,total:number){
  const p=clamp(position,0,total),padding=Math.min(2,(total-1)/2);
  if(p<padding)return p/padding*3;
  if(p>total-padding)return 37+(p-total+padding)/padding*3;
  return 3+(p-padding)/(total-padding*2)*34;
}
export function journeyColor(day:number[],night:number[],amount:number){return `rgb(${day.map((value,index)=>Math.round(value+(night[index]-value)*clamp(amount))).join(' ')})`;}
export function departingFlight(t:number){
  // Two curved legs: circle above the book, then climb out through the sky.
  const v=clamp(t),angle=v*Math.PI*1.6;
  return {x:Math.sin(angle)*260+v*160,y:-v*140-Math.pow(v,3)*520,angle:Math.sin(angle)*-16};
}
