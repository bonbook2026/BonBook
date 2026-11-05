const {test}=require('node:test'),assert=require('node:assert/strict');
const {ImageWorkflow,pendingTasks,targetFor,imageKey}=require('../src/image-workflow.cjs');
const core=require('../src/book-core.cjs');
function fixture(){return core.newProject('آزمایش تصویرسازی',[{number:1,heading:'',content:'زن کنار پنجره ایستاده بود.\n\nناگهان صدای برخورد باران به پنجره شنیده شد.\n\nسپس مرد از اتاق بیرون رفت.'},{number:2,heading:'',content:'روایت صفحهٔ بعد.'}]);}
function runner(p,overrides={}){
 let generated=[],submissions=0,downloads=[];
 const deps={project:()=>p,notify:()=>{},delay:async()=>{},select:async(page,scene)=>{p.selected=page.number;page.selectedScene=scene.id;},prompt:(_p,page,scene)=>page.number+':'+scene.id,prepare:async()=>{},scan:async()=>({images:[...generated],draftEmpty:true,pending:false,error:false}),submit:async()=>{submissions++;generated.push('https://chatgpt.com/image/'+submissions+'.png');},rememberChat:async()=>{},download:async(url,task)=>{const {scene}=targetFor(p,task);scene[task.asset]='assets/result.png';downloads.push(url);},...overrides};
 return {flow:new ImageWorkflow(deps),deps,get submissions(){return submissions;},get downloads(){return downloads;}};
}
test('automatic image queue skips saved artwork, preserves narration and voices, then completes each missing panel once',async()=>{
 const p=fixture();p.pages[0].audio='assets/voice.mp3';p.pages[0].audioCues=[{time:0,offset:0}];p.pages[0].scenes[0].image='assets/existing.png';const snapshot=()=>JSON.stringify(p.pages.map(({scenes,selectedScene,...page})=>page)),original=snapshot(),count=pendingTasks(p,'book').length,r=runner(p);await r.flow.start(p,'book');assert.equal(r.flow.status,'complete');assert.equal(r.submissions,count);assert.equal(r.downloads.length,count);assert.equal(p.pages[0].scenes[0].image,'assets/existing.png');assert.equal(snapshot(),original);
});
test('pausing while the server generates an image resumes that same request without submitting twice',async()=>{
 const p=fixture(),r=runner(p);let first=true;const scan=r.deps.scan;r.deps.scan=async()=>{const result=await scan();if(result.images.length&&first){first=false;r.flow.pause();}return result;};await r.flow.start(p,'scene');assert.equal(r.flow.status,'paused');assert.equal(r.submissions,1);await r.flow.resume();assert.equal(r.flow.status,'complete');assert.equal(r.submissions,1);assert.equal(r.downloads.length,1);
});
test('a transient download failure is retried automatically without generating the scene twice',async()=>{
 const p=fixture(),r=runner(p),save=r.deps.download;let once=true;r.deps.download=async(...args)=>{if(once){once=false;throw Error('Connection interrupted');}return save(...args);};await r.flow.start(p,'scene');assert.equal(r.flow.status,'complete');assert.equal(r.submissions,1);assert.equal(r.downloads.length,1);
});
test('changed source text and account limits stop the queue before any unrelated artwork is attached',async()=>{
 const p=fixture(),r=runner(p),scan=r.deps.scan;let calls=0;r.deps.scan=async()=>{const result=await scan();if(++calls===2)p.pages[0].content+=' متن تغییر کرد.';return result;};await r.flow.start(p,'scene');assert.equal(r.flow.status,'paused');assert.equal(r.downloads.length,0);
 const other=runner(fixture(),{scan:async()=>({images:[],pending:false,error:true,draftEmpty:true})});await other.flow.start(other.deps.project(),'scene');assert.equal(other.flow.status,'paused');assert.equal(other.downloads.length,0);
});
test('expiring display grants do not make old pictures appear to be a newly generated result',()=>{
 assert.equal(imageKey('https://chatgpt.com/content?id=file-123&token=old'),imageKey('https://chatgpt.com/content?id=file-123&token=new'));assert.notEqual(imageKey('https://chatgpt.com/content?id=file-123'),imageKey('https://chatgpt.com/content?id=file-456'));
});
test('a temporarily unavailable Send control is retried before submission without losing the panel',async()=>{
 const p=fixture(),r=runner(p),send=r.deps.submit;let once=true;r.deps.submit=async(...args)=>{if(once){once=false;throw Error('Send not ready');}return send(...args);};await r.flow.start(p,'scene');assert.equal(r.flow.status,'complete');assert.equal(r.submissions,1);
});
test('an uncertain submission is polled automatically and never sent again',async()=>{
 const p=fixture(),r=runner(p),send=r.deps.submit;r.deps.submit=async(text,mark)=>{mark();await send(text);throw Error('Result uncertain');};await r.flow.start(p,'scene');assert.equal(r.flow.status,'complete');assert.equal(r.submissions,1);
});
test('whole-book mode continues across page boundaries and retries are bounded during an outage',async()=>{
 const p=fixture(),r=runner(p),select=r.deps.select,visited=[];p.selected=2;r.deps.select=async(page,scene)=>{visited.push(page.number);await select(page,scene);};await r.flow.start(p,'book');assert.equal(r.flow.status,'complete');assert.ok(visited.includes(1)&&visited.includes(2));assert.deepEqual(visited,[...visited].sort((a,b)=>a-b));assert.equal(pendingTasks(p,'book').length,0);
 const failed=runner(fixture(),{download:async()=>{throw Error('Connection interrupted');}});await failed.flow.start(failed.deps.project(),'scene');assert.equal(failed.flow.status,'paused');assert.equal(failed.submissions,1);assert.equal(failed.flow.retries,2);
});
