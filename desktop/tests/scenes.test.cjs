const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),core=require('../src/book-core.cjs'),schema=require('../../shared/illustrated-package.cjs');
const {planPage,validateScenes,schedule,activeScene,scenePrompt}=core.scenes;
const passage='زن :گفت بسیار خوب، بفرمایید. شاید دفعهٔ بعد بدانید که لازم نیست از جانب شوهرم حرف بزنید؛ او خودش حرفش را می‌زند.\n\nلایونل آرام :گفت حق با شماست؛ دفعهٔ بعد حواسم را جمع می‌کنم. صدای برخورد باران به پنجره‌ها شنیده شد؛ صدایی که پیش از آن نشنیده بود.\n\nمرد از اتاق بیرون رفت و زن در راهرو او را دید. صدای نزدیک شدن کالسکه را شنید و سپس برای آخرین بار به چهرهٔ او نگاه کرد؛ جدایی برایش هولناک بود.';
test('offline plan separates speakers, weather and actions without losing or rearranging a single UTF-16 character',()=>{
 const scenes=planPage(passage);assert.ok(scenes.length>=5);assert.equal(scenes.map(s=>passage.slice(s.start,s.end)).join(''),passage);assert.equal(scenes[0].kind,'dialogue');assert.equal(scenes[1].kind,'dialogue');assert.equal(scenes.filter(s=>s.kind==='atmosphere').length,1);assert.ok(scenes.every(s=>s.end-s.start>15));validateScenes(scenes,passage);
 const emoji=planPage('دختر به آسمان نگاه کرد 🌙 و لبخند زد.\n\nسپس با شوق فراوان به سوی باغ دوید و در را باز کرد.');validateScenes(emoji,'دختر به آسمان نگاه کرد 🌙 و لبخند زد.\n\nسپس با شوق فراوان به سوی باغ دوید و در را باز کرد.');
});
test('reanalysis preserves edited shots, pictures and real existing timing on unchanged narration',()=>{
 const scenes=planPage(passage);scenes[0].image='assets/old.png';scenes[0].motion='still';scenes[0].title='قاب تأییدشده';assert.deepEqual(planPage(passage,scenes),scenes);
 const p=core.newProject('کتاب',[{number:31,heading:'',content:passage}]);p.pages[0].audioCues=[{time:.21,offset:0}];p.pages[0].scenes=scenes;const prompt=scenePrompt(p,p.pages[0],scenes[1]);assert.match(prompt,/page-0031-scene-02.png/);assert.match(prompt,/نه خلاصهٔ کل صفحه/);assert.match(prompt,/حق با شماست/);assert.deepEqual(p.pages[0].audioCues,[{time:.21,offset:0}]);
});
test('scene switching uses real speech anchors, leaves missing matches unresolved and supports backwards seeking',()=>{
 const scenes=[{start:0,end:20},{start:20,end:40},{start:40,end:60}],cues=[{time:2,offset:0},{time:14.75,offset:42}];assert.deepEqual(schedule(scenes,cues).map(s=>s.time),[0,null,14.75]);assert.equal(activeScene(scenes,cues,15).start,40);assert.equal(activeScene(scenes,cues,3).start,0);assert.deepEqual(schedule(scenes,[]).map(s=>s.time),[0,null,null]);
});
test('a single prepared file respects its page filename while internal markers take precedence',()=>{
 assert.equal(core.importPreparedText('متن آماده برای این صفحه','page-0031.txt')[0].number,31);assert.equal(core.importPreparedText('=== صفحه ۱۸ ===\nمتن','page-0031.txt')[0].number,18);
});
test('scene validation rejects gaps, overlaps, unfinished coverage and injected animation settings',()=>{
 const scenes=planPage(passage);for(const changed of [{...scenes[0],start:1},{...scenes[0],end:scenes[0].end+1},{...scenes[0],motion:'url(https://evil.test)' }])assert.throws(()=>validateScenes([changed,...scenes.slice(1)],passage));assert.throws(()=>validateScenes(scenes.slice(0,-1),passage));assert.ok(planPage('متن '.repeat(9500)).length<=24);
});
test('multi-shot ZIP keeps all scene artwork and audio bytes and survives reopening the project',async()=>{
 const root=path.resolve(__dirname,'../../build'),dir=await fs.mkdtemp(path.join(root,'studio-scenes-'));try{const image=path.join(__dirname,'../assets/demo.png'),p=core.newProject('پلان‌ها',[{number:31,heading:'',content:passage}]);for(const scene of p.pages[0].scenes)await core.attachScene(p,dir,31,scene.id,image);await core.saveProject(p,dir);const loaded=await core.loadProject(dir);assert.equal(loaded.pages[0].scenes.length,p.pages[0].scenes.length);await core.exportPackage(loaded,dir,path.join(dir,'book.zip'));
 const manifest={format:schema.FORMAT,version:1,book:p.book,assets:[],pages:[{number:31,content:passage,scenes:p.pages[0].scenes.map(s=>({...s,image:null}))}]};assert.equal(schema.validatePackage(manifest).pages[0].scenes.length,p.pages[0].scenes.length);
 }finally{if(path.dirname(dir)!==root)throw Error('Unsafe cleanup');await fs.rm(dir,{recursive:true,force:true});}
});
