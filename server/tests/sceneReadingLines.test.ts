import {describe,it,expect} from 'vitest';
import {contentHash,readingLines,sceneReadingLines} from '../src/services/speechService';
describe('Illustrated narration boundaries',()=>{
 it('requests actual ASR anchors at scene starts even inside an uninterrupted sentence',()=>{
  const content='دختر کنار پنجره ایستاده بود و سپس مرد به سوی کالسکه رفت و در را باز کرد.',at=content.indexOf('سپس'),page={content,illustratedScenes:[{start:0,end:at,contentHash:contentHash(content)},{start:at,end:content.length,contentHash:contentHash(content)}]},lines=sceneReadingLines(page);expect(lines.some(l=>l.start===at)).toBe(true);for(const line of lines)expect(content.slice(line.start,line.end)).toBe(line.text);
 });
 it('keeps ordinary books unchanged and ignores obsolete scene geometry after a text edit',()=>{const content='این روایت تازه است.';expect(sceneReadingLines({content})).toEqual(readingLines(content));expect(sceneReadingLines({content,illustratedScenes:[{start:100,end:300,contentHash:'stale'}]})).toEqual(readingLines(content));});
});
