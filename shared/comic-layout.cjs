'use strict';
const clip=(text,max)=>{const clean=text.trim();if(clean.length<=max)return clean;const space=clean.lastIndexOf(' ',max);return clean.slice(0,space>max*.6?space:max).trimEnd()+'…';};
function comicText(content,scene){
 const text=content.slice(scene.start,scene.end).trim(),quote=/[«“"]([^»”"]{12,})[»”"]/.exec(text),said=/(?:[:：]\s*(?:گفت|پرسید)|(?:گفت|پرسید|پاسخ داد|جواب داد)\s*[:：])/u.exec(text);
 if(scene.kind==='dialogue'&&(quote||said)){const start=quote?quote.index:said.index+said[0].length,speech=quote?quote[1]:text.slice(start).split(/(?<=[.!?؟])\s+/u)[0];return {narration:clip(text.slice(0,quote?quote.index:said.index),100),dialogue:clip(speech,190)};}
 return {narration:clip(text,180),dialogue:''};
}
function comicSheets(scenes){const sheets=[];for(let i=0;i<scenes.length;i+=7)sheets.push(scenes.slice(i,i+7));return sheets;}
function panelSpans(count){if(count===7)return [3,3,2,2,2,3,3];if(count===6)return [3,3,3,3,3,3];if(count===5)return [3,3,2,2,2];if(count===4)return [3,3,3,3];if(count===3)return [6,3,3];if(count===2)return [6,6];return [6];}
module.exports={comicText,comicSheets,panelSpans};
