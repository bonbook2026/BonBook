const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=file=>ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function pure(file){const c={exports:{}};vm.runInNewContext(source(file),c);return c.exports;}
const queue=pure('utils/bookAudioQueue.ts'),narration=pure('utils/narration.ts'),journey=pure('utils/readingJourney.ts');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function audioFixture(load){
 const players=[];let state;
 class Player{duration=120;currentTime=0;set src(value){this.url=value;this.currentTime=0;}get src(){return this.url;}setAttribute(){}removeAttribute(){}load(){}pause(){}play(){return Promise.resolve();}}
 const Audio=function(){const p=new Player();players.push(p);return p;};
 const page=number=>({bookId:1,number,content:'متن آزمایشی برای هماهنگی صدا',audioUrl:'/api/media/track-'+number,audioCues:[{time:0,offset:0},{time:60,offset:12}]});
 const react={useState:initial=>{state=initial;return [initial,value=>state=value];},useRef:value=>({current:value}),useEffect:()=>{},createContext:()=>({}),useContext:()=>null};
 const api={mediaUrl:url=>url,api:{library:{page:load||(async(_book,number)=>({page:page(number)}))}}};
 const c={exports:{},Audio,URL,Event,window:{location:{origin:'https://bonbook.test'},speechSynthesis:{cancel(){},pause(){},resume(){}}},require:name=>name==='react'?react:name==='../services/api'?api:name==='../utils/narration'?narration:name==='../utils/bookAudioQueue'?queue:name==='./useAuth'?{}:require(name)};
 vm.runInNewContext(source('hooks/useNarration.tsx'),c);const audio=c.exports.useNarrationState(),book={id:1,title:'آزمون',language:'fa-IR',pages:[2,4,8].map(number=>({number,hasAudio:true}))};
 return {audio,book,players,page,state:()=>state};
}
test('sky seeking enters the real recording at its chosen percent and next/previous tracks restart normally',async()=>{
 const f=audioFixture();await f.audio.playBook(f.book,4,undefined,37.5);const player=f.players[0];player.onloadedmetadata();assert.equal(player.currentTime,45);assert.equal(f.state().target.number,4);assert.equal(f.state().position,37.5);
 f.audio.nextBook();await flush();player.onloadedmetadata();assert.equal(f.state().target.number,8);assert.equal(player.currentTime,0);
 f.audio.previousBook();await flush();player.onloadedmetadata();assert.equal(f.state().target.number,4);assert.equal(player.currentTime,0);
});
test('a silent requested page advances to the next voice without carrying its fractional offset',async()=>{
 const f=audioFixture();await f.audio.playBook(f.book,3,undefined,70);f.players[0].onloadedmetadata();assert.equal(f.state().target.number,4);assert.equal(f.players[0].currentTime,0);
});
test('a newer sky seek wins when old page requests return out of order',async()=>{
 const old=deferred(),recent=deferred(),f=audioFixture((_book,number)=>number===4?old.promise:recent.promise);
 const first=f.audio.playBook(f.book,4,undefined,10),second=f.audio.playBook(f.book,8,undefined,80);recent.resolve({page:f.page(8)});await second;old.resolve({page:f.page(4)});await first;
 assert.equal(f.players.length,1);f.players[0].onloadedmetadata();assert.equal(f.state().target.number,8);assert.equal(f.players[0].currentTime,96);
});
test('refreshing an expired grant retains the sky seek offset',async()=>{
 const f=audioFixture(),page={...f.page(4),audioUrl:'/api/media/track-4?expires=1'};await f.audio.playBook(f.book,4,page,40);await flush();f.players[0].onloadedmetadata();assert.equal(f.players[0].currentTime,48);assert.equal(f.state().target.number,4);
});
test('a touched image line starts at its real seconds before duration loads and keeps continuous playback',async()=>{
 const f=audioFixture();await f.audio.playBook(f.book,4,undefined,0,17.25);const player=f.players[0];player.onloadedmetadata();assert.equal(player.currentTime,17.25);assert.equal(f.state().mode,'book');
 f.audio.nextBook();await flush();player.onloadedmetadata();assert.equal(player.currentTime,0);
});
test('line seconds survive an expired grant and are never carried into a different recording',async()=>{
 const f=audioFixture();await f.audio.playBook(f.book,4,{...f.page(4),audioUrl:'/api/media/track-4?expires=1'},0,23);await flush();f.players[0].onloadedmetadata();assert.equal(f.players[0].currentTime,23);
 await f.audio.playBook(f.book,3,undefined,0,50);f.players[0].onloadedmetadata();assert.equal(f.state().target.number,4);assert.equal(f.players[0].currentTime,0);
 f.audio.play({bookId:1,number:4,title:'Fixture',language:'fa-IR',...f.page(4)},1,31);f.players[0].onloadedmetadata();assert.equal(f.players[0].currentTime,31);assert.equal(f.state().mode,'page');
});
test('touching a line while paused resumes at the new time through a single expired-grant refresh',async()=>{
 const f=audioFixture();await f.audio.playBook(f.book,4);f.players[0].onloadedmetadata();f.audio.pause();f.state().target.audioUrl='/api/media/track-4?expires=1';f.audio.seek(50,true);await flush();f.players[0].onloadedmetadata();assert.equal(f.players[0].currentTime,60);assert.equal(f.state().status,'playing');
});
function controlFixture(){
 const calls={seek:[],start:0,cancel:0},cleanups=[],react={useState:value=>[value,()=>{}],useRef:current=>({current}),useEffect:effect=>{const cleanup=effect();if(cleanup)cleanups.push(cleanup);}};
 const c={exports:{},require:name=>name==='react'?react:journey};vm.runInNewContext(source('hooks/useReaderJourney.ts'),c);
 const control=c.exports.useReaderJourney({position:0,total:338,enabled:true,scope:1,onSeek:async value=>{calls.seek.push(value);},onStart:()=>calls.start++,onCancel:()=>calls.cancel++});
 control.orbit.current={getBoundingClientRect:()=>({left:0,width:1000})};const target={setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
 return {calls,control,cleanups,event:(x=500)=>({button:0,pointerId:1,currentTarget:target,clientX:x,preventDefault(){}})};
}
test('dragging previews locally and commits one real seek on release, while cancellation and unmount resume the prior state',async()=>{
 const f=controlFixture();f.control.onPointerDown(f.event(80));f.control.onPointerMove(f.event(400));f.control.onPointerMove(f.event(700));assert.equal(f.calls.seek.length,0);assert.equal(f.calls.start,1);f.control.onPointerUp(f.event(700));assert.equal(f.calls.seek.length,1);assert.ok(f.calls.seek[0]>200);
 const canceled=controlFixture();canceled.control.onPointerDown(canceled.event());canceled.control.onPointerCancel(canceled.event());assert.equal(canceled.calls.seek.length,0);assert.equal(canceled.calls.cancel,1);
 const closed=controlFixture();closed.control.onPointerDown(closed.event());closed.cleanups[0]();assert.equal(closed.calls.cancel,1);
 await flush();
});
test('sky keyboard seeking consumes reader navigation keys and ignores autorepeat',async()=>{
 const f=controlFixture();let prevented=0,stopped=0;const event={key:'End',repeat:false,preventDefault:()=>prevented++,stopPropagation:()=>stopped++};f.control.onKeyDown(event);assert.equal(f.calls.seek[0],338);f.control.onKeyDown({...event,repeat:true});assert.equal(f.calls.seek.length,1);assert.equal(prevented,2);assert.equal(stopped,2);await flush();
});
