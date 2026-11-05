'use strict';
const clip=(text,max)=>{const clean=text.trim();if(clean.length<=max)return clean;const space=clean.lastIndexOf(' ',max);return clean.slice(0,space>max*.6?space:max).trimEnd()+'…';};
function comicText(content,scene){
 const text=content.slice(scene.start,scene.end).trim(),quote=/[«“"]([^»”"]{12,})[»”"]/.exec(text),said=/(?:[:：]\s*(?:گفت|پرسید)|(?:گفت|پرسید|پاسخ داد|جواب داد)\s*[:：])/u.exec(text);
 if(scene.kind==='dialogue'&&(quote||said)){const start=quote?quote.index:said.index+said[0].length,speech=quote?quote[1]:text.slice(start).split(/(?<=[.!?؟])\s+/u)[0];return {narration:clip(text.slice(0,quote?quote.index:said.index),100),dialogue:clip(speech,190)};}
 return {narration:clip(text,180),dialogue:''};
}
function comicSheets(scenes){const sheets=[];for(let i=0;i<scenes.length;i+=7)sheets.push(scenes.slice(i,i+7));return sheets;}
function panelSpans(count){if(count===7)return [3,3,2,2,2,3,3];if(count===6)return [3,3,3,3,3,3];if(count===5)return [3,3,2,2,2];if(count===4)return [3,3,3,3];if(count===3)return [6,3,3];if(count===2)return [6,6];return [6];}
function frameGeometry(total,index){
 if(!Number.isInteger(total)||total<1||total>24||!Number.isInteger(index)||index<0||index>=total)throw Error('کادر تصویر معتبر نیست.');
 const start=Math.floor(index/7)*7,count=Math.min(7,total-start),spans=panelSpans(count),span=spans[index-start],rows=Math.ceil(spans.reduce((a,b)=>a+b,0)/6);
 // Reference sheet: 1200 px wide; reserve a separate caption strip per row.
 // Derive the image prompt ratio from the existing comic grid layout.
 const referenceWidth=1200,gap=12,caption=96,width=(referenceWidth-gap*5)/6*span+gap*(span-1),height=(referenceWidth/.74-gap*(rows-1)-caption*rows)/rows,scale=1536/Math.max(width,height);
 const w=Math.round(width*scale/8)*8,h=Math.round(height*scale/8)*8;
 return {width:w,height:h,orientation:w/h>1.05?'افقی':w/h<.95?'عمودی':'مربع',span};
}
module.exports={comicText,comicSheets,panelSpans,frameGeometry};
