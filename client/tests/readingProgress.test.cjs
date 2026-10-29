const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const context={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/readingProgress.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const {DEVICE_HISTORY_KEY,deviceReadingHistory,saveDeviceReading,resumeDevicePage,deviceLibraryResume}=context.exports;
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};};
test('remembers the latest page on this device without an account and resumes only existing pages',()=>{
 const store=storage();saveDeviceReading({bookId:5,pageNumber:11,title:'کتاب',heading:'پیشگفتار',updatedAt:100},store);saveDeviceReading({bookId:5,pageNumber:12,title:'کتاب',heading:'ادامه',updatedAt:200},store);
 assert.equal(deviceReadingHistory(store).length,1);assert.equal(store.getItem('bonbook_reading_5'),'12');assert.equal(store.getItem('bonbook_bookmark_5'),'12');
 assert.equal(resumeDevicePage(5,[{number:1},{number:11},{number:12}],store),12);assert.equal(resumeDevicePage(5,[{number:1},{number:11}],store),1);
 assert.equal(deviceLibraryResume([{id:8},{id:5}],deviceReadingHistory(store)).pageNumber,12);assert.equal(deviceLibraryResume([{id:8}],deviceReadingHistory(store)),null);
});
test('tolerates broken storage, migrates earlier device progress, and bounds history',()=>{
 const store=storage();store.setItem(DEVICE_HISTORY_KEY,'bad JSON');store.setItem('bonbook_reading_5','11');assert.equal(resumeDevicePage(5,[{number:2},{number:11}],store),11);
 const entries=Array.from({length:130},(_,index)=>({bookId:index+1,pageNumber:2,title:'کتاب',heading:'صفحه',updatedAt:index+1}));entries.push({bookId:1,pageNumber:-1,title:'bad',heading:'bad',updatedAt:900});store.setItem(DEVICE_HISTORY_KEY,JSON.stringify(entries));
 assert.equal(deviceReadingHistory(store).length,100);assert.equal(deviceReadingHistory(store)[0].bookId,130);
 assert.equal(saveDeviceReading({bookId:1,pageNumber:3,title:'کتاب',heading:'ادامه',updatedAt:500},{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}}),false);
});
