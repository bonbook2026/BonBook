import {afterAll,describe,expect,it,vi} from 'vitest';
import fs from 'fs/promises';
import sync from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
const fixture=vi.hoisted(()=>({root:''}));
vi.mock('../src/config',()=>{fixture.root=sync.mkdtempSync(path.join(os.tmpdir(),'bonbook-word-queue-'));return {config:{mediaDirectory:path.join(fixture.root,'media')}};});
import {pageLineMap,sameAudioWords} from '../src/services/pageLineService';
afterAll(async()=>{const target=path.resolve(fixture.root),temporary=path.resolve(os.tmpdir());if(!target.startsWith(temporary+path.sep)||!path.basename(target).startsWith('bonbook-word-queue-'))throw new Error('Unsafe test cleanup path');await fs.rm(target,{recursive:true,force:true});});
describe('Private reader word preparation',()=>{
 const page={content:'متن اصلاح‌شده',visualMode:'AUTO',language:'fa-IR',audioAssetId:'voice',audioCues:'[]',audioCueMode:'NONE',sourcePageNumber:1,image:null,source:{id:'pdf',filename:'private.pdf',mimeType:'application/pdf'},audio:{id:'voice',filename:'private.mp3',mimeType:'audio/mpeg'},alignments:[]};
 it('reuses actual words from the same audio after text/cue edits but rejects another recording',()=>{
  const words=[{text:'کتاب',start:4,end:5,probability:1}],job={contentHash:'previous-text',audioAssetId:'voice',cues:'previous-cues',words:JSON.stringify(words)};
  expect(sameAudioWords({...page,alignments:[job]})).toEqual(words);
  expect(sameAudioWords({...page,alignments:[{...job,audioAssetId:'other'}]})).toBeUndefined();
 });
 it('queues a page without cues once and never runs OCR or the speech model in the web request',async()=>{
  expect((await pageLineMap(page)).status).toBe('processing');await pageLineMap(page);
  const jobs=await fs.readdir(path.join(fixture.root,'page-line-maps/jobs'));expect(jobs).toHaveLength(1);
  const descriptor=JSON.parse(await fs.readFile(path.join(fixture.root,'page-line-maps/jobs',jobs[0]),'utf8'));
  expect(descriptor.page.content).toBe(page.content);expect(descriptor.page.audioCueMode).toBe('NONE');expect(descriptor.key).toMatch(/^[a-f0-9]{64}$/);
  expect((await fs.readdir(path.join(fixture.root,'page-line-maps'))).filter(name=>name.endsWith('.json'))).toEqual([]);
 });
 it('serves partial word maps while background preparation is pending, across a restart',async()=>{
  const directory=path.join(fixture.root,'page-line-maps'),job=(await fs.readdir(path.join(directory,'jobs')))[0],key=job.slice(0,64);
  const value={status:'ready',coverage:1,lines:[],words:[],refining:true,timedWordCount:0};await fs.writeFile(path.join(directory,key+'.json'),JSON.stringify(value));
  expect(await pageLineMap(page)).toEqual(value);expect(await pageLineMap({...page,language:'fa'})).toEqual(value);
 });
 it('keeps ready physical maps when subtitle review changes cues, while isolating changed content and recordings',async()=>{
  const directory=path.join(fixture.root,'page-line-maps'),job=(await fs.readdir(path.join(directory,'jobs')))[0],key=job.slice(0,64);
  const ready={status:'ready',coverage:.96,lines:[{start:0,end:10,time:2,x:.1,y:.2,width:.8,height:.03}],words:[],refining:false,timedWordCount:0};
  await fs.writeFile(path.join(directory,key+'.json'),JSON.stringify(ready));
  expect(await pageLineMap({...page,audioCues:'[{"time":3,"offset":0}]',audioCueMode:'PARTIAL'})).toEqual(ready);
  expect((await pageLineMap({...page,content:page.content+' تازه'})).status).toBe('processing');
  expect((await pageLineMap({...page,audioAssetId:'new-recording'})).status).toBe('processing');
 });
 it('migrates completed v6 line-only maps without repeating OCR or speech recognition',async()=>{
  const input={...page,sourcePageNumber:12},directory=path.join(fixture.root,'page-line-maps');
  const key=crypto.createHash('sha256').update(JSON.stringify(['words-v6-worker','pdf',12,'voice','fa',input.content,input.audioCues,'auto'])).digest('hex');
  const ready={status:'ready',coverage:.96,lines:[{start:0,end:10,time:2,x:.1,y:.2,width:.8,height:.03}],words:[],refining:false,timedWordCount:0};
  await fs.writeFile(path.join(directory,key+'.json'),JSON.stringify(ready));
  const before=await fs.readdir(path.join(directory,'jobs'));
  expect(await pageLineMap(input)).toEqual(ready);
  expect(await fs.readdir(path.join(directory,'jobs'))).toEqual(before);
 });
});
