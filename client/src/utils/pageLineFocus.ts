export interface ImageReadingLine{start:number;end:number;x:number;y:number;width:number;height:number;time?:number}
export function bookFocusTransform(single:boolean,line:ImageReadingLine|null,visibleFraction=1){
 const scale=single?1.8:2.25,u=single?.5:.75,edge=Math.max(.02,Math.min(1,visibleFraction))/(2*scale),v=Math.max(edge,Math.min(1-edge,line?line.y+line.height/2:.22));
 return `translate(${(.5-u*scale)*100}%,${(.5-v*scale)*100}%) scale(${scale})`;
}
export function activeImageLine(lines:ImageReadingLine[],offset:number,time:number,useTimes:boolean){
 if(offset<0)return null;
 if(useTimes){const timed=lines.filter(line=>typeof line.time==='number');for(let i=timed.length-1;i>=0;i--)if(time>=timed[i].time!)return timed[i];return null;}
 return lines.find(line=>offset>=line.start&&offset<line.end)||null;
}
export function hitImageLine(lines:ImageReadingLine[],x:number,y:number){
 if(x<0||x>1||y<0||y>1)return null;
 return lines.filter(line=>x>=line.x-.012&&x<=line.x+line.width+.012&&y>=line.y-.006&&y<=line.y+line.height+.006).sort((a,b)=>Math.abs(y-a.y-a.height/2)-Math.abs(y-b.y-b.height/2))[0]||null;
}
export function imageLineTime(line:ImageReadingLine,cues:{time:number;offset:number}[]=[]){
 const time=line.time??cues.find(cue=>cue.offset>=line.start&&cue.offset<line.end)?.time;
 return typeof time==='number'&&Number.isFinite(time)&&time>=0?time:null;
}
