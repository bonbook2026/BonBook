import {describe,it,expect} from 'vitest';
import {filterNarrationText,filterTextAndCues,validateTextFilters,textFilterSignature} from '../src/services/textFilters';
import {parseNumberedTexts,planTextFilterChanges} from '../src/services/pageTextImport';

describe('Literal ignored phrases and breathing markers',()=>{
 it('removes the narration instruction without joining words or removing ordinary prose',()=>{
  expect(filterNarrationText('جهان <short pause> یکی است.').content).toBe('جهان یکی است.');
  expect(filterNarrationText('انسان<SHORT PAUSE>زندگی').content).toBe('انسان زندگی');
  expect(filterNarrationText('<short pause>\n\nمتن کتاب\n<short pause>').content).toBe('متن کتاب');
  expect(filterNarrationText('short pause یک اصطلاح است؛ <math> در متن می‌ماند.').removedCount).toBe(0);
 });
 it('treats any configured phrase as literal text, with no regex execution',()=>{
  const result=filterNarrationText('الف a+b ب aab پ .* ت (نفس) ث', ['a+b','.*','(نفس)']);
  expect(result.content).toBe('الف ب aab پ ت ث');expect(result.removedCount).toBe(3);
  expect(filterNarrationText('الف دیگر ب',[]).content).toBe('الف دیگر ب');
 });
 it('merges adjacent removals, preserves paragraph breaks, and keeps Unicode offsets valid',()=>{
  const old='📖 اول <short pause> <short pause> دوم\n<short pause>\nسوم',result=filterNarrationText(old);
  expect(result.removedCount).toBe(3);expect(result.content).toBe('📖 اول دوم\n\nسوم');expect(result.mapOffset(old.indexOf('دوم'))).toBe(result.content.indexOf('دوم'));expect(result.mapOffset(old.indexOf('سوم'))).toBe(result.content.indexOf('سوم'));
 });
 it('preserves every media timestamp and mode-compatible source offset during deletion',()=>{
  const old='خط اول.\n<short pause>\nخط دوم. <short pause> خط سوم.',input=[{time:.125,offset:0},{time:8.75,offset:old.indexOf('خط دوم')},{time:19,offset:old.indexOf('خط سوم')}];
  const result=filterTextAndCues(old,JSON.stringify(input),'audio',['<short pause>']);
  expect(JSON.parse(result.cues)).toEqual([{time:.125,offset:0},{time:8.75,offset:result.content.indexOf('خط دوم')},{time:19,offset:result.content.indexOf('خط سوم')}]);expect(result.approximate).toBe(false);
 });
 it('does not move page boundaries and cleans both whole-file and per-page sources',()=>{
  const whole=parseNumberedTexts([{name:'full.txt',text:'=== Page 11 ===\nمتن <short pause> سالم\n=== Page 12 ===\nآغاز <short pause> پایان'}]);
  const parts=parseNumberedTexts([{name:'page-0012.txt',text:'آغاز <short pause> پایان'},{name:'page-0011.txt',text:'متن <short pause> سالم'}]);
  expect(whole.map(({number,content})=>({number,content}))).toEqual(parts.map(({number,content})=>({number,content})));
  expect(whole.map(p=>p.removedCount)).toEqual([1,1]);expect(parseNumberedTexts([{name:'1.txt',text:'متن (نفس) آخر'}],['(نفس)'])[0].content).toBe('متن آخر');
 });
 it('builds guarded current-text cleanup without changing media or cue times',()=>{
  const old='بخوان <short pause> و بشنو.',page={id:1,bookId:5,number:60,heading:'عنوان محفوظ',content:old,keywords:'معرفت',audioAssetId:'audio',audioCues:JSON.stringify([{time:0,offset:0},{time:9,offset:old.indexOf('بشنو')}]),audioCueMode:'AUTO',sourceAssetId:'pdf',sourcePageNumber:60,imageAssetId:null,visualMode:'BOTH'};
  const [change]=planTextFilterChanges([page],['<short pause>']);expect(change.status).toBe('READY');expect(change.mode).toBe('AUTO');expect(change.content).toBe('بخوان و بشنو.');expect(JSON.parse(change.cues).map((cue:any)=>cue.time)).toEqual([0,9]);expect(change.beforeContent).toBe(old);expect(change.afterHash).toBeTruthy();expect(change.removedCount).toBe(1);expect(page.content).toBe(old);
 });
 it('allows an explicitly empty filter and rejects oversized or multiline rules',()=>{
  expect(validateTextFilters([' <short pause> ','<SHORT PAUSE>','','نفس'])).toEqual(['<short pause>','نفس']);expect(validateTextFilters([])).toEqual([]);
  expect(()=>validateTextFilters(['الف\nب'])).toThrow();expect(()=>validateTextFilters(['x'.repeat(201)])).toThrow();expect(()=>validateTextFilters(Array(51).fill('a'))).toThrow();expect(textFilterSignature(['الف','B'])).toBe(textFilterSignature(['b','الف']));
 });
 it('keeps too-short caption replacements for review instead of dropping timestamps',()=>{
  const changes=planTextFilterChanges([{id:1,number:1,content:'<short pause>',audioAssetId:'audio',audioCues:'[{"time":1,"offset":0}]',audioCueMode:'MANUAL'}],['<short pause>']);expect(changes[0].status).toBe('REVIEW');expect(changes[0].afterHash).toBeUndefined();
 });
});
