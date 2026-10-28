import {describe,it,expect} from 'vitest';
import {parseContents} from '../src/services/contentsService';
describe('Contents suggestions',()=>{
  it('reads Persian, Arabic and Latin destinations and keeps subsection levels',()=>{
    expect(parseContents('فهرست مطالب\nمقدمه ........ ۱۱\nفصل اول | 17\nبخش اول: شناخت ..... ١٨\n>> جزئیات | ۱۹')).toEqual([
      {title:'مقدمه',pageNumber:11,level:0},{title:'فصل اول',pageNumber:17,level:0},{title:'بخش اول: شناخت',pageNumber:18,level:1},{title:'جزئیات',pageNumber:19,level:2}
    ]);
  });
  it('rejects empty and nonnumeric destinations and deduplicates pasted rows',()=>{
    expect(parseContents('مقدمه | ۰\nمقدمه | متن\nفصل اول | ۱۷\nفصل اول | 17\n۱۲۳')).toEqual([{title:'فصل اول',pageNumber:17,level:0}]);
  });
});
