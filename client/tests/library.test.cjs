const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/library.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const {chooseLibraryPreview,savedBookIds}=context.exports;
test('library sample uses an uploaded recording and prefers the current page or a real introduction',()=>{
 const pages=[{number:1,heading:'آغاز',hasAudio:false},{number:2,heading:'شناسنامه',hasAudio:true},{number:10,heading:'مانیفست کتاب',hasAudio:true},{number:11,heading:'پیشگفتار',hasAudio:true}];
 assert.equal(chooseLibraryPreview(pages).number,10);assert.equal(chooseLibraryPreview(pages,11).number,11);assert.equal(chooseLibraryPreview(pages,1).number,10);
 assert.equal(chooseLibraryPreview(pages.filter(page=>!page.hasAudio)),null);assert.equal(chooseLibraryPreview([]),null);
 assert.equal(chooseLibraryPreview([{number:0,heading:'نامعتبر',hasAudio:true},{number:7,heading:'روایت',hasAudio:true}]).number,7);
});
test('saved library books tolerate damaged browser storage without treating strings or objects as ids',()=>{
 assert.deepEqual(Array.from(savedBookIds('not JSON')),[]);assert.deepEqual(Array.from(savedBookIds('{"id":5}')),[]);
 assert.deepEqual(Array.from(savedBookIds('[5,5,"6",null,-1,0,6,1.5,{},99999999999999999]')),[5,6]);
});
