'use strict';
function findSeparator(bitmap,size,axis,expected,radius,from,to,dark=false){
 const limit=axis==='x'?size.width:size.height,start=Math.max(1,Math.round(expected-radius)),end=Math.min(limit-2,Math.round(expected+radius)),a=Math.max(0,Math.round(from)),b=Math.min(axis==='x'?size.height:size.width,Math.round(to));let best=null;
 for(let p=start;p<=end;p++){let hit=0,count=0;const step=Math.max(1,Math.floor((b-a)/450));for(let q=a;q<b;q+=step){const index=(axis==='x'?(q*size.width+p):(p*size.width+q))*4,r=bitmap[index],g=bitmap[index+1],blue=bitmap[index+2];if(dark?Math.max(r,g,blue)<85:Math.min(r,g,blue)>232)hit++;count++;}const score=hit/Math.max(1,count);if(score<(dark?.72:.88))continue;const distance=Math.abs(p-expected);if(!best||distance<best.distance||distance===best.distance&&score>best.score)best={p,distance,score};}
 return best?.p??Math.round(expected);
}
function panelRects(image,layout,pixelRect){
 const size=image.getSize();if(typeof image.toBitmap!=='function')return layout.panels.map(r=>pixelRect(r,layout,size));
 const bitmap=image.toBitmap();if(bitmap.length!==size.width*size.height*4)return layout.panels.map(r=>pixelRect(r,layout,size));
 const yCuts=[0];for(let i=1;i<layout.rows.length;i++){const r=layout.panels[layout.rows[i][0]],at=r.y/layout.height*size.height;yCuts.push(findSeparator(bitmap,size,'y',at,size.height*.065,size.width*.02,size.width*.98));}yCuts.push(size.height);
 const result=[];
 for(let row=0;row<layout.rows.length;row++){
  const indexes=layout.rows[row],top=yCuts[row],bottom=yCuts[row+1],r=layout.panels[indexes[0]],expectedBottom=layout.captioned?top+(bottom-top)*r.height/(r.height+96):bottom;
  const artBottom=layout.captioned?findSeparator(bitmap,size,'y',expectedBottom,size.height*.025,size.width*.02,size.width*.98,true):bottom;
  const sorted=[...indexes].reverse(),cuts=[0];for(let i=1;i<sorted.length;i++){const at=layout.panels[sorted[i]].x/layout.width*size.width;cuts.push(findSeparator(bitmap,size,'x',at,size.width*.13,top+(artBottom-top)*.05,artBottom-(artBottom-top)*.05));}cuts.push(size.width);
  if(cuts.some((p,i)=>i&&p<=cuts[i-1]+10)||artBottom<=top+10)throw Error('مرز کادرهای تصویر مشخص نیست؛ قالب تصویری را بررسی کن.');
  for(let i=0;i<sorted.length;i++){const inset=2;result[sorted[i]]={x:cuts[i]+inset,y:top+inset,width:cuts[i+1]-cuts[i]-inset*2,height:artBottom-top-inset*2};}
 }
 return result;
}
module.exports={findSeparator,panelRects};
