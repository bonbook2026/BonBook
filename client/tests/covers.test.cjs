const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/cover.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{}};vm.runInNewContext(code,context);const {coverRegions}=context.exports;
test('a Persian full cover keeps its front on the left and excludes the spine from both faces',()=>{
  const regions=coverRegions({coverLayout:'SPREAD',coverFrontSide:'LEFT',coverSpineStart:48,coverSpineEnd:52});
  assert.equal(regions.front.start,0);assert.equal(regions.front.end,.48);
  assert.equal(regions.back.start,.52);assert.equal(regions.back.end,1);
  assert.equal(regions.spine.start,.48);assert.equal(regions.spine.end,.52);
});
test('opposite layout swaps faces without mirroring or overlapping the image',()=>{
  const regions=coverRegions({coverFrontSide:'RIGHT',coverSpineStart:45,coverSpineEnd:51});
  assert.equal(regions.front.start,.51);assert.equal(regions.front.end,1);
  assert.equal(regions.back.start,0);assert.equal(regions.back.end,.45);
  assert.ok(regions.front.start>regions.back.end);
});
test('a cover with no spine keeps both entire halves',()=>{
  const regions=coverRegions({coverSpineStart:50,coverSpineEnd:50});
  assert.equal(regions.front.end,.5);assert.equal(regions.back.start,.5);
});
