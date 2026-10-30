import {describe,it,expect} from 'vitest';
import crypto from 'crypto';
import {buildBookSetupProgress,SetupBook} from '../src/services/bookSetupProgress';
const page=(data:any={})=>({number:1,content:'متن ذخیره‌شدهٔ کتاب',visualMode:'AUTO',audioAssetId:null,audioCues:'[]',audioCueMode:'NONE',...data});
const book=(data:Partial<SetupBook>={}):SetupBook=>({title:'کتاب',author:'نویسنده',category:'عمومی',status:'DRAFT',coverAssetId:null,pages:[],contents:[],...data});
const stage=(data:SetupBook,id:string)=>buildBookSetupProgress(data).steps.find(step=>step.id===id)!;
describe('Persisted book setup progress',()=>{
 it('does not confuse a title, document preview or uploaded proposal with applied book content',()=>{
  const current=book({author:'',imports:[{status:'REVIEW',totalPages:300,completedPages:300}]});
  expect(buildBookSetupProgress(current).nextStep).toBe('metadata');expect(stage(current,'pages').status).toBe('review');
  expect(stage(current,'text').status).toBe('todo');expect(stage(current,'cover').status).toBe('optional');
  expect(stage(book({pages:[page()]}),'pages').status).toBe('done');
 });
 it('counts actual saved text and recordings across page-number gaps and excludes explicitly image-only pages',()=>{
  const current=book({pages:[page({number:2,audioAssetId:'voice'}),page({number:10,content:' \n '}),page({number:42,content:'',visualMode:'IMAGE'})]});
  expect(stage(current,'text')).toMatchObject({completed:1,total:2,remaining:1,pageNumbers:[10],status:'todo'});
  expect(stage(current,'audio')).toMatchObject({completed:1,total:2,remaining:1,pageNumbers:[10],status:'todo'});
  expect(stage(current,'alignment')).toMatchObject({total:1,remaining:1,pageNumbers:[2],status:'todo'});
 });
 it('requires applied valid cues and ignores jobs for a replaced recording or changed text',()=>{
  const current=book({pages:[page({audioAssetId:'voice',alignments:[{audioAssetId:'voice',contentHash:crypto.createHash('sha256').update(page().content).digest('hex'),status:'READY'}]})]});
  expect(stage(current,'alignment').status).toBe('review');expect(stage(current,'alignment').completed).toBe(0);
  current.pages[0].content+=' تازه';expect(stage(current,'alignment').status).toBe('todo');
  current.pages[0].audioCues='[{"time":0,"offset":0}]';current.pages[0].audioCueMode='AUTO';expect(stage(current,'alignment').status).toBe('done');
  current.pages[0].audioCueMode='PARTIAL';expect(stage(current,'alignment').status).toBe('review');
 });
 it('rejects corrupt, empty, descending and out-of-range saved cue arrays',()=>{
  for(const cues of ['not json','{}','[]','[{"time":0,"offset":99999}]','[{"time":2,"offset":1},{"time":1,"offset":0}]'])expect(stage(book({pages:[page({audioAssetId:'voice',audioCues:cues,audioCueMode:'MANUAL'})]}),'alignment').status).not.toBe('done');
 });
 it('accepts saved manual timings without requiring a speech job and rolls back ticks when data is removed',()=>{
  const current=book({status:'PUBLISHED',coverAssetId:'cover',pages:[page({audioAssetId:'voice',audioCues:'[{"time":0,"offset":0}]',audioCueMode:'MANUAL'})],contents:[{pageNumber:1}]});
  expect(buildBookSetupProgress(current)).toMatchObject({completed:6,total:6,nextStep:null});
  current.pages[0].audioAssetId=null;current.pages[0].audioCues='[]';current.coverAssetId=null;current.status='HIDDEN';
  expect(buildBookSetupProgress(current).nextStep).toBe('audio');expect(stage(current,'publish').status).toBe('todo');expect(stage(current,'cover').status).not.toBe('done');
 });
 it('treats a picture-only book and optional empty contents honestly but still sees an active audio batch',()=>{
  const current=book({status:'PUBLISHED',pages:[page({visualMode:'IMAGE',content:''})]});
  for(const id of ['text','audio','alignment','contents'])expect(stage(current,id).status).toBe('optional');
  expect(buildBookSetupProgress(current)).toMatchObject({completed:3,total:3,nextStep:null});
  current.audioBatches=[{status:'UPLOADING',items:[{status:'WAITING'}]}];expect(stage(current,'audio').status).toBe('working');expect(buildBookSetupProgress(current).nextStep).toBe('audio');
 });
 it('flags invalid contents destinations and bounds page samples without hiding the true remaining count',()=>{
  const current=book({pages:Array.from({length:50},(_,index)=>page({number:index+1,content:''})),contents:[{pageNumber:999}]});
  expect(stage(current,'contents').status).toBe('review');expect(stage(current,'text').remaining).toBe(50);expect(stage(current,'text').pageNumbers).toHaveLength(12);
 });
});
