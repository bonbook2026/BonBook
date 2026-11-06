'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('both image methods and every explicit renderer action pass the isolated desktop bridge; unknown actions stay blocked',async()=>{
 let studio;const sent=[],ipcRenderer={invoke:async(name,payload)=>{sent.push({name,payload});return {accepted:true};},on:()=>{},removeListener:()=>{}},contextBridge={exposeInMainWorld:(name,value)=>{assert.equal(name,'studio');studio=value;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:name=>{assert.equal(name,'electron');return {ipcRenderer,contextBridge};}});
 const ui=fs.readFileSync(path.join(__dirname,'../ui/studio.js'),'utf8'),actions=new Set([...ui.matchAll(/\bcall\('([a-z-]+)'/g)].map(m=>m[1]));
 for(const name of actions)assert.equal((await studio.call(name,{mode:'sheet'})).accepted,true,name);
 for(const name of ['image-mode','prepare-comic-page','attach-comic-page','preview-comic-template','clear-scene-image','restore-scene-image','realign-comic-page','copy-continuation','export-continuation','choose-visual-references']){assert.equal((await studio.call(name,{mode:'sheet'})).accepted,true,name);assert.ok(sent.some(s=>s.name==='studio:'+name),name);}
 const start=sent.find(s=>s.name==='studio:workflow-start');assert.equal(start.payload.mode,'sheet');await assert.rejects(()=>studio.call('untrusted-action'),/Unknown action/);
});
