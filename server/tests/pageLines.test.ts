import {describe,it,expect} from 'vitest';
import {tsvRows,pageLineMap} from '../src/services/pageLineService';
describe('Original page line geometry',()=>{
 it('combines OCR word boxes into real normalized rows, excluding uncertain detections',()=>{
  const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t100\t200\t70\t30\t95\tکتاب\n5\t1\t1\t1\t1\t2\t200\t202\t100\t31\t80\tخوب\n5\t1\t1\t1\t2\t1\t50\t300\t10\t10\t10\tnoise';
  expect(tsvRows(tsv,1000,2000)).toEqual([{text:'کتاب خوب',x:.1,y:.1,width:.2,height:.0165}]);
 });
 it('does not queue OCR for text-only or explicitly image-only pages',async()=>{
  const p={content:'متن',visualMode:'IMAGE',audioAssetId:null,audioCues:'[]',audioCueMode:'NONE',sourcePageNumber:1,image:null,source:{id:'fixture',filename:'missing.pdf',mimeType:'application/pdf'},alignments:[]};
  expect((await pageLineMap(p)).status).toBe('unavailable');expect((await pageLineMap({...p,visualMode:'TEXT'})).lines).toEqual([]);
 });
});
