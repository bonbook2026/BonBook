const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/pageCanvas.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture(overrides={}){
 const calls=[],bitmap={width:1600,height:2000,close:()=>calls.push('closed')},canvas={width:1,height:1,getContext:()=>({drawImage:(...args)=>calls.push(args)})};
 const context={exports:{},HTMLImageElement:class{},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,blob:async()=>({})};},createImageBitmap:async()=>bitmap,...overrides};
 vm.runInNewContext(compiled,context);return {paint:context.exports.paintPageCanvas,canvas,calls,bitmap};
}
test('draws authenticated stamped pixels without storing the media URL on the canvas',async()=>{
 const f=fixture(),controller=new AbortController();await f.paint(f.canvas,'/api/media/private-image?grant=temporary',controller.signal);
 assert.equal(f.canvas.width,1600);assert.equal(f.canvas.height,2000);assert.equal(f.calls[0].options.credentials,'same-origin');assert.equal(f.calls[0].options.cache,'no-store');assert.equal(f.calls[0].options.signal,controller.signal);
 assert.equal(f.calls[1][0],f.bitmap);assert.equal(f.calls.at(-1),'closed');assert.equal(JSON.stringify(f.canvas).includes('grant'),false);
});
test('aborted page navigation never paints an old decoded page and frees its bitmap',async()=>{
 const controller=new AbortController(),f=fixture({createImageBitmap:async()=>{controller.abort();return f.bitmap;}});
 await f.paint(f.canvas,'/api/media/old',controller.signal);assert.equal(f.canvas.width,1);assert.equal(f.calls.filter(Array.isArray).length,0);assert.equal(f.calls.at(-1),'closed');
});
test('refuses HTTP failures and releases images when canvas drawing fails',async()=>{
 const f=fixture({fetch:async()=>({ok:false})});await assert.rejects(f.paint(f.canvas,'/api/media/expired',new AbortController().signal),/unavailable/);
 const broken=fixture();broken.canvas.getContext=()=>null;await assert.rejects(broken.paint(broken.canvas,'/api/media/page',new AbortController().signal),/Canvas/);assert.equal(broken.calls.at(-1),'closed');
});
test('bounds oversized pages while preserving aspect ratio',async()=>{
 const f=fixture();f.bitmap.width=4800;f.bitmap.height=6000;await f.paint(f.canvas,'/api/media/large',new AbortController().signal);assert.equal(f.canvas.width,1920);assert.equal(f.canvas.height,2400);
});
test('older browsers decode an off-document blob image and revoke the temporary object URL',async()=>{
 const revoked=[];class Image{naturalWidth=800;naturalHeight=1000;set src(value){if(value)queueMicrotask(()=>this.onload());}}
 const f=fixture({createImageBitmap:undefined,HTMLImageElement:Image,Image,URL:{createObjectURL:()=> 'blob:temporary',revokeObjectURL:url=>revoked.push(url)}});
 await f.paint(f.canvas,'/api/media/page',new AbortController().signal);assert.equal(f.canvas.width,800);assert.equal(f.canvas.height,1000);assert.deepEqual(revoked,['blob:temporary']);
});
