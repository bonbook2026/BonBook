import {describe,expect,it} from 'vitest';
import {fairSpeechOrder,speechQueueSnapshot} from '../src/services/speechQueue';
import {validSpeechWords} from '../src/services/speechService';
describe('Speech queue scheduling and honest progress',()=>{
 const job=(bookId:number,pageNumber:number,status='QUEUED')=>({id:`${bookId}-${pageNumber}`,bookId,pageNumber,status,progress:status==='PROCESSING'?.42:0});
 it('starts a newly waiting book without draining the earlier book and preserves FIFO inside each book',()=>{
  const jobs=[job(5,317),job(5,318),job(5,319),job(6,8),job(6,9),job(7,1)];
  expect(fairSpeechOrder(jobs,5).map(job=>job.id)).toEqual(['6-8','7-1','5-317','6-9','5-318','5-319']);
  expect(fairSpeechOrder(jobs,null)[0].id).toBe('5-317');expect(fairSpeechOrder([],5)).toEqual([]);
  expect(jobs.map(job=>job.id)).toEqual(['5-317','5-318','5-319','6-8','6-9','7-1']);
 });
 it('reports the active recording and fair queue position rather than claiming a waiting book is processing at zero',()=>{
  const jobs=[job(5,317,'PROCESSING'),job(5,318),job(5,319),job(6,8),job(6,9)],state={heartbeat:100000,lastBookId:5,active:{...job(5,317,'PROCESSING'),startedAt:90000}};
  const snapshot=speechQueueSnapshot(jobs,state,6,110000);
  expect(snapshot.online).toBe(true);expect(snapshot.active?.pageNumber).toBe(317);expect(snapshot.active?.progress).toBe(.42);
  expect(snapshot.nextPosition).toBe(2);expect(snapshot.positions.get('5-318')).toBe(3);
  expect(speechQueueSnapshot(jobs,state,6,160000).online).toBe(false);
  expect(speechQueueSnapshot(jobs,null,6).online).toBe(false);
 });
 it('keeps rotation across a restart and reports a finished book with no remaining turn',()=>{
  const state={heartbeat:100000,lastBookId:5,active:null};
  expect(speechQueueSnapshot([job(5,318),job(6,8)],state,6,110000).nextPosition).toBe(1);
  expect(speechQueueSnapshot([job(6,8)],state,5,110000).nextPosition).toBe(0);
 });
 it('rejects malformed, backwards or non-finite recognition instead of using invented timestamps',()=>{
  const words=[{text:'کتاب',start:1,end:2,probability:.9},{text:'زندگی',start:2.2,end:3}];
  expect(validSpeechWords(words)).toBe(true);expect(validSpeechWords([])).toBe(false);
  expect(validSpeechWords([{...words[0],end:Infinity}])).toBe(false);
  expect(validSpeechWords([...words,{...words[0],start:0}])).toBe(false);
  expect(validSpeechWords([{...words[0],probability:2}])).toBe(false);
 });
});
