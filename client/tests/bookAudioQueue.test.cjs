const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/bookAudioQueue.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{}};vm.runInNewContext(code,context);const {BookAudioQueue,recordedPages}=context.exports;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
test('plays recorded pages in book order, skips silent page ranges, and completes once',async()=>{
 const pages=recordedPages([{number:12,hasAudio:true},{number:5},{number:4,hasAudio:true},{number:2,hasAudio:true},{number:10,hasAudio:false},{number:4,hasAudio:true}]);assert.deepEqual([...pages],[2,4,12]);
 const played=[],completed=[],loaded=[];const queue=new BookAudioQueue(pages,{load:async number=>{loaded.push(number);return number;},loading:()=>{},play:number=>played.push(number),complete:count=>completed.push(count),error:()=>assert.fail('unexpected error')});
 await queue.start();await queue.next();await queue.next();await queue.next();await queue.next();assert.deepEqual(loaded,[2,4,12]);assert.deepEqual(played,[2,4,12]);assert.deepEqual(completed,[3]);
});
test('skips an audio track removed after the metadata snapshot without opening a silent page',async()=>{
 const played=[],completed=[];const queue=new BookAudioQueue([2,4,10],{load:async number=>number===4?null:number,loading:()=>{},play:number=>played.push(number),complete:count=>completed.push(count),error:()=>assert.fail('unexpected error')});
 await queue.start();await queue.next();assert.deepEqual(played,[2,10]);await queue.next();assert.deepEqual(completed,[2]);
});
test('stop cancels a pending load and never restarts the recording',async()=>{
 const pending=deferred(),played=[];const queue=new BookAudioQueue([2],{load:()=>pending.promise,loading:()=>{},play:number=>played.push(number),complete:()=>assert.fail('stopped queue completed'),error:()=>assert.fail('unexpected error')});
 const starting=queue.start();queue.stop();pending.resolve(2);await starting;assert.deepEqual(played,[]);
});
test('a later jump wins when page requests finish out of order',async()=>{
 const first=deferred(),last=deferred(),played=[];const queue=new BookAudioQueue([2,4,10],{load:number=>number===2?first.promise:last.promise,loading:()=>{},play:number=>played.push(number),complete:()=>{},error:()=>assert.fail('unexpected error')});
 const starting=queue.start(),jumping=queue.jump(5);last.resolve(10);await jumping;first.resolve(2);await starting;assert.deepEqual(played,[10]);assert.equal(queue.index,2);
});
test('failed loads wait for retry instead of falling back to synthesized text',async()=>{
 let attempts=0;const errors=[],played=[];const queue=new BookAudioQueue([4],{load:async number=>{if(++attempts===1)throw Error('offline');return number;},loading:()=>{},play:number=>played.push(number),complete:()=>{},error:(_error,number)=>errors.push(number)});
 await queue.start();assert.deepEqual(errors,[4]);assert.deepEqual(played,[]);await queue.retry();assert.deepEqual(played,[4]);
});
test('continuous listening begins at the current page and skips gaps without restarting earlier recordings',async()=>{
 const played=[],completed=[];const queue=new BookAudioQueue([2,4,10],{load:async number=>number,loading:()=>{},play:number=>played.push(number),complete:count=>completed.push(count),error:()=>assert.fail('unexpected error')});
 await queue.start(3);assert.deepEqual(played,[4]);await queue.next();assert.deepEqual(played,[4,10]);await queue.next();assert.deepEqual(completed,[2]);
 played.length=0;completed.length=0;await queue.start(11);assert.deepEqual(played,[]);assert.deepEqual(completed,[0]);
});
