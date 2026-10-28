import {describe,it,expect} from 'vitest';
import {validateAudioCues} from '../src/services/audioCues';
describe('Audio text timing validation',()=>{
  it('stores ordered media times with exact text offsets',()=>{expect(JSON.parse(validateAudioCues([{time:0,offset:0},{time:3.2,offset:5}],'این متن کتاب است.','audio-id'))).toEqual([{time:0,offset:0},{time:3.2,offset:5}]);});
  it('rejects reversed, overlapping and out of bounds cues and missing audio',()=>{
    for(const cues of [[{time:2,offset:0},{time:1,offset:5}],[{time:0,offset:0},{time:0,offset:5}],[{time:0,offset:99}],[{time:0,offset:-1}],[{time:NaN,offset:0}]])expect(()=>validateAudioCues(cues,'این متن کتاب است.','audio')).toThrow();
    expect(()=>validateAudioCues([{time:0,offset:0}],'این متن',null)).toThrow();expect(validateAudioCues([],'',null)).toBe('[]');
  });
});
