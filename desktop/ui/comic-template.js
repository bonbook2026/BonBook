'use strict';
window.renderComicTemplate=async function(data){
 await document.fonts.load('24px Vazirmatn');await document.fonts.ready;
 const canvas=document.getElementById('sheet');canvas.width=Math.ceil(data.width);canvas.height=Math.ceil(data.height);const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.direction='rtl';ctx.textAlign='right';
 for(const panel of data.panels){
  const c=panel.caption;ctx.fillStyle='#e9f0f5';ctx.fillRect(panel.x,panel.y,panel.width,panel.height);ctx.strokeStyle='#172a39';ctx.lineWidth=4;ctx.strokeRect(panel.x+2,panel.y+2,panel.width-4,panel.height+c.height-4);
  ctx.textAlign='center';ctx.fillStyle='#335c77';ctx.font='74px Vazirmatn';ctx.fillText(panel.number.toLocaleString('fa-IR'),panel.x+panel.width/2,panel.y+panel.height/2);ctx.font='22px Vazirmatn';ctx.fillText('فقط این ناحیه را تصویرسازی کن',panel.x+panel.width/2,panel.y+panel.height/2+45);
  ctx.fillStyle='#fff3d4';ctx.fillRect(c.x+4,c.y,c.width-8,c.height-4);ctx.strokeStyle='#172a39';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(c.x+4,c.y);ctx.lineTo(c.x+c.width-4,c.y);ctx.stroke();ctx.font='22px Vazirmatn';ctx.textAlign='right';ctx.fillStyle='#182c25';
  const words=panel.text.split(/\s+/),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>c.width-32&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
  for(let i=0;i<Math.min(3,lines.length);i++){let text=lines[i];if(i===2&&lines.length>3){while(ctx.measureText(text+'…').width>c.width-32)text=text.slice(0,-1);text+='…';}ctx.fillText(text,c.x+c.width-16,c.y+28+i*27);}
 }
 return canvas.toDataURL('image/png');
};
