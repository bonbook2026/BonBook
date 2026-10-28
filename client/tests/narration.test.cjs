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
