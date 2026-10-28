const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/narration.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{}};vm.runInNewContext(code,context);const {readingLines,cueOffset}=context.exports;
test('reading segments preserve Persian text, punctuation and exact source offsets',()=>{
 const text='  این خط اول است. آیا درست می‌خوانیم؟\n\nبخش دوم؛ با دقت بخوان!';const lines=readingLines(text);
 assert.equal(lines.length,4);for(const line of lines)assert.equal(text.slice(line.start,line.end),line.text);
 assert.equal(lines.map(l=>l.text).join('').replace(/\s/g,''),text.replace(/\s/g,''));assert.notEqual(lines[0].paragraph,lines[2].paragraph);
});
test('long segments split without losing text and cues follow media time after seeking',()=>{
 const text='کتاب‌خوانی با تمرکز '.repeat(50),lines=readingLines(text);assert.ok(lines.length>3);assert.equal(lines.map(l=>l.text).join('').replace(/\s/g,''),text.replace(/\s/g,''));
 const cues=[{time:2,offset:0},{time:8,offset:35},{time:15,offset:80}];assert.equal(cueOffset(cues,1),-1);assert.equal(cueOffset(cues,8),35);assert.equal(cueOffset(cues,16),80);assert.equal(cueOffset(cues,3),0);
});

test('short subtitles keep exact PDF text offsets when a recording is sought forward and backward',()=>{
 const text='پیشگفتار:\n\n'+ 'جهان یکی است، اما انسان‌ها در جهان‌های متفاوتی زندگی می‌کنند. '.repeat(8);
 const subtitles=readingLines(text,72),cues=subtitles.map((line,index)=>({time:index*3,offset:line.start}));
 assert.ok(subtitles.length>8);
 assert.equal(subtitles.map(line=>line.text).join('').replace(/\s/g,''),text.replace(/\s/g,''));
 for(const line of subtitles){assert.equal(text.slice(line.start,line.end),line.text);assert.ok(line.text.length<=73);}
 for(const time of [18,6,24,0]){const offset=cueOffset(cues,time),selected=subtitles.findIndex((line,index)=>offset>=line.start&&(index===subtitles.length-1||offset<subtitles[index+1].start));assert.equal(selected,time/3);}
});
