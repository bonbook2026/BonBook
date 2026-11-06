'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const core=require('../src/book-core.cjs'),{pageLayout,pixelRect,pagePrompt,pageTask,pageTarget,attachPage}=require('../src/comic-page.cjs'),{pendingTasks,ImageWorkflow,targetFor}=require('../src/image-workflow.cjs');
function book(count=7){const parts=Array.from({length:count},(_,i)=>'روایت شمارهٔ '+(i+1)+' در این بخش کتاب.'),text=parts.join('\n\n'),p=core.newProject('کتاب آزمایش',[{number:13,heading:'روایت',content:text}]),template=p.pages[0].scenes[0];let offset=0;p.pages[0].scenes=parts.map((part,i)=>{const start=offset;offset+=part.length+(i<count-1?2:0);return {...template,id:'s-test-'+i,start,end:offset};});p.pages[0].selectedScene=p.pages[0].scenes[0].id;return p;}
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
async function cleanTemporary(directory){const target=path.resolve(directory),root=path.resolve(os.tmpdir())+path.sep;if(!target.startsWith(root)||!/^bonbook-comic-(?:sheet|rollback)-/.test(path.basename(target)))throw Error('Invalid test cleanup path');await fs.rm(target,{recursive:true,force:true});}
test('one composite uses the original RTL two/three/two panel order and has bounded nonoverlapping crops',()=>{
 assert.deepEqual(pageLayout(7).rows,[[0,1],[2,3,4],[5,6]]);
 for(let total=1;total<=24;total++){
  const layout=pageLayout(total);assert.equal(layout.panels.length,total);
  for(const r of layout.panels){const box=pixelRect(r,layout,{width:1024,height:1536});assert.ok(box.x>=0&&box.y>=0&&box.width>0&&box.height>0&&box.x+box.width<=1024&&box.y+box.height<=1536);}
  for(const row of layout.rows)for(let i=1;i<row.length;i++){const right=layout.panels[row[i-1]],left=layout.panels[row[i]];assert.ok(left.x+left.width<right.x);}
 }
});
test('a single page prompt includes every excerpt exactly once, fixed layout, no generated captions and one output',()=>{
 const p=book(),page=p.pages[0],prompt=pagePrompt(p,page);assert.ok(page.scenes.length>1);assert.match(prompt,/فقط یک تصویرِ چندکادری/);assert.match(prompt,/هیچ متن، حباب، زیرنویس/);assert.match(prompt,/صفحهٔ 13/);
 assert.equal((prompt.match(/<panel-reference>/g)||[]).length,page.scenes.length);for(const s of page.scenes)assert.ok(prompt.includes(page.content.slice(s.start,s.end)));assert.match(prompt,/page-0013-all-panels\.png/);
});
test('both methods remain selectable; a complete page is skipped and single-panel ignores the sheet mode',()=>{
 const p=book(),count=p.pages[0].scenes.length;assert.ok(count>1);assert.equal(pendingTasks(p,'book').length,count);assert.equal(pendingTasks(p,'book','sheet').length,1);assert.equal(pendingTasks(p,'scene','sheet')[0].asset,'image');
 for(const s of p.pages[0].scenes)s.image='assets/existing.png';assert.equal(pendingTasks(p,'book','sheet').length,0);
 const layered=book();layered.pages[0].scenes[0].layered=true;assert.throws(()=>pendingTasks(layered,'book','sheet'),/لایه/);assert.ok(pendingTasks(layered,'book').length>1);
});
test('the sheet queue submits only once per incomplete page, retries retrieval without resending, and preserves existing scenes',async()=>{
 const p=book(),first=p.pages[0],next=structuredClone(first);next.number=14;p.pages.push(next);first.scenes[0].image='assets/existing.png';first.audio='assets/voice.mp3';first.audioCues=[{time:0,offset:0}];const before=first.content,cues=structuredClone(first.audioCues);let submissions=0,downloads=0,fail=true;const urls=[];
 const flow=new ImageWorkflow({project:()=>p,notify:()=>{},delay:async()=>{},select:async()=>{},prepare:async()=>{},prompt:(_p,page)=>pagePrompt(_p,page),rememberChat:async()=>{},scan:async()=>({images:[...urls],pending:false}),submit:async()=>{submissions++;urls.push('https://chatgpt.com/image/'+submissions);},download:async(_url,task)=>{if(fail){fail=false;throw Error('Connection interrupted');}const {page}=targetFor(p,task);for(const s of page.scenes)if(!s.image)s.image='assets/new.png';downloads++;}});
 await flow.start(p,'book','sheet');assert.equal(flow.status,'complete');assert.equal(submissions,2);assert.equal(downloads,2);assert.equal(first.scenes[0].image,'assets/existing.png');assert.equal(first.content,before);assert.deepEqual(first.audioCues,cues);assert.equal(first.audio,'assets/voice.mp3');assert.equal(pendingTasks(p,'book','sheet').length,0);
});
test('page or panel changes invalidate a submitted sheet before it can attach',()=>{
 const p=book(),task=pageTask(p.pages[0]);p.pages[0].scenes[1].end--;assert.throws(()=>pageTarget(p,task),/تغییر/);
});
test('sheet import is transactional, retains existing image/audio/cues and exports normal independent scene assets',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'bonbook-comic-sheet-'));try{
  const p=book(),page=p.pages[0],source=path.join(directory,'sheet.png');await fs.writeFile(source,png);await core.attachScene(p,directory,page.number,page.scenes[0].id,source,'image');const existing=page.scenes[0].image;
  await fs.writeFile(path.join(directory,'voice.mp3'),Buffer.concat([Buffer.from('ID3'),Buffer.alloc(40)]));await core.attach(p,directory,page.number,path.join(directory,'voice.mp3'),'audio');page.audioCues=[{time:0,offset:0}];const cue=JSON.stringify(page.audioCues),audio=page.audio;
  const boxes=[],readImage=()=>({getSize:()=>({width:1200,height:1600}),isEmpty:()=>false,crop:rect=>{boxes.push(rect);return {toPNG:()=>png};}});
  const result=await attachPage(p,directory,pageTask(page),source,readImage);assert.equal(result.panels,page.scenes.length-1);assert.equal(boxes.length,result.panels);assert.equal(page.scenes[0].image,existing);assert.equal(page.audio,audio);assert.equal(JSON.stringify(page.audioCues),cue);assert.equal(page.comicSources.length,1);assert.ok((await fs.readFile(core.resolveAsset(directory,result.source))).equals(png));
  await core.saveProject(p,directory);const restored=await core.loadProject(directory);assert.deepEqual(restored.pages,p.pages);assert.equal(restored.imageMode,'scenes');const zip=path.join(directory,'book.zip');const exported=await core.exportPackage(restored,directory,zip);assert.equal(exported.images,page.scenes.length);assert.equal(exported.audio,1);
 }finally{await cleanTemporary(directory);}
});
test('a crop failure or concurrent source edit attaches none of the newly cropped panels',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'bonbook-comic-rollback-'));try{
  const p=book(),page=p.pages[0],source=path.join(directory,'sheet.png');await fs.writeFile(source,png);let n=0;
  const readImage=()=>({getSize:()=>({width:1200,height:1600}),isEmpty:()=>false,crop:()=>{if(++n===2)throw Error('Crop failed');return {toPNG:()=>png};}});
  await assert.rejects(()=>attachPage(p,directory,pageTask(page),source,readImage),/Crop failed/);assert.ok(page.scenes.every(s=>!s.image));assert.deepEqual(await fs.readdir(path.join(directory,'assets')),[]);
  n=0;const editImage=()=>({getSize:()=>({width:1200,height:1600}),isEmpty:()=>false,crop:()=>{if(++n===2)page.content+=' تغییر';return {toPNG:()=>png};}});await assert.rejects(()=>attachPage(p,directory,pageTask(page),source,editImage),/تغییر/);assert.ok(page.scenes.every(s=>!s.image));assert.deepEqual(await fs.readdir(path.join(directory,'assets')),[]);
 }finally{await cleanTemporary(directory);}
});
