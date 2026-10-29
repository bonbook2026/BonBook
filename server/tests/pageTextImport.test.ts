import {describe,it,expect} from 'vitest';
import {parseNumberedTexts,planTextChanges,remapTextCues,decodePageText,textPageHash} from '../src/services/pageTextImport';

describe('Numbered prepared text and narration timing',()=>{
 it('matches full-file markers with per-page files, including blanks and non-Latin numbers',()=>{
  const full=parseNumberedTexts([{name:'full-text.txt',text:'\ufeff=== Page 1 ===\r\n\r\n=== Page ۱۱ ===\r\nمتن یازدهم\r\n\r\n=== Page ١٢ ===\nمتن دوازدهم'}]);
  const parts=parseNumberedTexts([{name:'page-0012.txt',text:'متن دوازدهم'},{name:'page-0001.txt',text:'\n'},{name:'صفحه-۱۱.txt',text:'متن یازدهم'}]);
  expect(full.map(({number,content})=>({number,content}))).toEqual(parts.map(({number,content})=>({number,content})));
  expect(full.map(p=>p.number)).toEqual([1,11,12]);expect(full[0].content).toBe('');
 });
 it('never invents pagination or silently resolves duplicate and ambiguous files',()=>{
  expect(()=>parseNumberedTexts([{name:'full.txt',text:'متن بلند بدون شماره'}])).toThrow('شمارهٔ صفحه');
  expect(()=>parseNumberedTexts([{name:'full.txt',text:'=== Page 1 ===\nاول\n=== Page 1 ===\nدوم'}])).toThrow('تکراری');
  expect(()=>parseNumberedTexts([{name:'page-1.txt',text:'اول'},{name:'1.md',text:'دوم'}])).toThrow('تکراری');
  expect(()=>parseNumberedTexts([{name:'full.txt',text:'متن بی‌نشان\n=== Page 2 ===\nدوم'}])).toThrow('بدون شماره');
  expect(()=>parseNumberedTexts([{name:'page-0.txt',text:'متن'}])).toThrow('شماره');
 });
 it('decodes UTF-8 and both Word-compatible UTF-16 byte orders',()=>{
  const text='صفحه ۲\nکتاب فارسی';expect(decodePageText(Buffer.from(text))).toBe(text);
  const le=Buffer.from(text,'utf16le');expect(decodePageText(Buffer.concat([Buffer.from([255,254]),le]))).toBe(text);
  expect(decodePageText(Buffer.concat([Buffer.from([254,255]),Buffer.from(le).swap16()]))).toBe(text);
 });
 it('moves caption offsets with corrected text while keeping every timestamp exactly',()=>{
  const old='جهان یکی است.\nانسان زندگی را تجربه میکند.',next='جهان، یکی است.\nانسان زندگی را تجربه می‌کند.';
  const cues=[{time:.4,offset:0},{time:8.25,offset:old.indexOf('انسان')}],mapped=remapTextCues(old,next,JSON.stringify(cues),'voice-id');
  expect(JSON.parse(mapped.cues)).toEqual([{time:.4,offset:0},{time:8.25,offset:next.indexOf('انسان')}]);expect(mapped.exact).toBe(2);
 });
 it('preserves identity and skips blanks, missing pages and unchanged text',()=>{
  const page={id:1,bookId:9,number:11,heading:'عنوان موجود',content:'جهان یکی است.',keywords:'جهان',audioAssetId:'voice',audioCues:'[{"time":1,"offset":0}]',audioCueMode:'MANUAL',imageAssetId:'image',sourceAssetId:'pdf',sourcePageNumber:11,visualMode:'BOTH'};
  const parsed=parseNumberedTexts([{name:'all.txt',text:'=== Page 10 ===\n\n=== Page 11 ===\nجهان یکی است.\n=== Page 12 ===\nناشناخته'}]);
  const plan=planTextChanges(parsed,[{...page,number:10},page],0);expect(plan.map(p=>p.status)).toEqual(['EMPTY','UNCHANGED','MISSING']);
  const corrected=planTextChanges([{number:1,content:'جهان، یکی است.',source:'page-1.txt'}],[page],10)[0];expect(corrected.number).toBe(11);expect(corrected.status).toBe('READY');expect(corrected.heading).toBe(page.heading);expect(corrected.cues).toBe(page.audioCues);expect(corrected.beforeHash).toBe(textPageHash(page));
 });
 it('flags unrelated pages and uncertain cue remapping rather than auto-selecting them',()=>{
  const page={id:2,number:5,content:'الف ب پ ت ث ج چ ح خ د',audioAssetId:'voice',audioCues:'[{"time":1,"offset":0}]',audioCueMode:'AUTO'};
  const plan=planTextChanges([{number:5,content:'موضوع دیگری درباره ستاره و آسمان',source:'5.txt'}],[page],0)[0];expect(plan.status).toBe('REVIEW');expect(plan.similarity).toBeLessThan(.45);expect(JSON.parse(plan.cues)[0].time).toBe(1);
 });
 it('does not apply impossible caption maps or accept corrupt existing cues',()=>{
  const mapped=planTextChanges([{number:1,content:'ج',source:'1.txt'}],[{id:1,number:1,content:'الف ب پ',audioAssetId:'a',audioCues:'[{"time":1,"offset":0},{"time":2,"offset":4}]',audioCueMode:'AUTO'}],0)[0];
  expect(mapped.status).toBe('REVIEW');expect(mapped.afterHash).toBeUndefined();
  expect(()=>remapTextCues('متن','متن تازه','[{"time":1,"offset":900}]','a')).toThrow('زمان‌بندی');
 });
});
