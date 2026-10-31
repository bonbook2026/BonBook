export interface ImageReadingLine{start:number;end:number;x:number;y:number;width:number;height:number;time?:number}
export function bookFocusTransform(single:boolean,line:ImageReadingLine|null){
 const scale=single?1.8:2.25,u=single?.5:.75,v=Math.max(.5/scale,Math.min(1-.5/scale,line?line.y+line.height/2:.22));
 return `translate(${(.5-u*scale)*100}%,${(.5-v*scale)*100}%) scale(${scale})`;
}
export function activeImageLine(lines:ImageReadingLine[],offset:number,time:number,useTimes:boolean){
 if(offset<0)return null;
 if(useTimes){const timed=lines.filter(line=>typeof line.time==='number');for(let i=timed.length-1;i>=0;i--)if(time>=timed[i].time!)return timed[i];return null;}
 return lines.find(line=>offset>=line.start&&offset<line.end)||null;
}
