const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/audioFiles.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{}};vm.runInNewContext(code,context);const {audioPageNumber}=context.exports;
test('maps Arabic, Persian and zero padded filenames without confusing folder numbers',()=>{for(const [name,page] of [['10.mp3',10],['۰۰۴.m4a',4],['٠١١.ogg',11],['02/02.mp3',2],['book1-page-17.mp3',17],['پارت ۱۰.mp3',10]])assert.equal(audioPageNumber(name),page);});
test('leaves ambiguous, absent and invalid page numbers for manual review',()=>{for(const name of ['book-1-10.mp3','voice.mp3','000.mp3','100001.mp3'])assert.equal(audioPageNumber(name),null);});
