import {describe,it,expect} from 'vitest';
import {planSmartReview} from '../src/services/smartReviewPolicy';
import {readingLines} from '../src/services/speechService';
describe('Evidence-based safe audio repair',()=>{
 const text='کتاب زندگی زیباست.\nجهان روشن است.\nصدای تازه می‌آید.';
 const lines=readingLines(text),cues=lines.map((line,i)=>({offset:line.start,time:i*3+1}));
 const result={cues,evidence:lines.map(line=>({offset:line.start,matched:3,total:3,leadingMissed:0,probability:.95})),coverage:.95,spokenCoverage:.95,lineCoverage:1,safe:true,duration:12};
 it('ignores punctuation-only fragments and merges a Persian prefix or artificial short tail without changing text offsets',()=>{
  const content='کتاب زندگی است.\n».\nانسان جهان را می\nسازد.';
  const rows=readingLines(content);expect(rows).toHaveLength(2);expect(rows[1].text).toBe('انسان جهان را می\nسازد.');
  for(const row of rows)expect(content.slice(row.start,row.end)).toBe(row.text);
 });
 it('keeps full manual and automatic timings byte-for-byte even when the new suggestion disagrees',()=>{
  const previous='[ { "time": 2.14, "offset": 0 } ]';
  for(const mode of ['MANUAL','AUTO']){const plan=planSmartReview(text,'voice',previous,mode,result,lines);expect(plan.status).toBe('PRESERVED');expect(plan.cues).toBe(previous);expect(plan.added).toBe(0);}
 });
 it('fills blanks while retaining every existing anchor at its exact original seconds',()=>{
  const previous=JSON.stringify([{offset:cues[0].offset,time:1.123}]),plan=planSmartReview(text,'voice',previous,'PARTIAL',result,lines);
  expect(plan.status).toBe('FIXED');expect(plan.added).toBe(2);expect(JSON.parse(plan.cues)[0].time).toBe(1.123);expect(plan.preserved).toBe(1);
 });
 it('never inserts across a conflicting old anchor or applies an unrelated/weak recognition',()=>{
  const previous=JSON.stringify([{offset:cues[1].offset,time:10}]);const plan=planSmartReview(text,'voice',previous,'PARTIAL',result,lines);
  expect(plan.status).toBe('UNRESOLVED');expect(plan.cues).toBe(previous);
  expect(planSmartReview(text,'voice','[]','NONE',{...result,coverage:.2,spokenCoverage:.1},lines).cues).toBe('[]');
 });
 it('retains partial evidence honestly and never guesses a missing sentence time',()=>{
  const longText=text+'\nبخش جدید و شنیده‌نشده.',allLines=readingLines(longText),plan=planSmartReview(longText,'voice','[]','NONE',{...result,safe:false,lineCoverage:.75},allLines);
  expect(plan.status).toBe('PARTIAL');expect(plan.mode).toBe('PARTIAL');expect(JSON.parse(plan.cues)).toEqual(cues);expect(plan.unresolved).toEqual([allLines[3].start]);
 });
});
