const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),bridge=require('../src/chat-composer.cjs');
function fixture(initial=''){
 const editor={value:initial,disabled:false,id:'',getClientRects:()=>[{}],getAttribute:name=>name==='aria-label'?'Ask ChatGPT':null,closest:()=>null,focus:()=>{}},root={querySelectorAll:selector=>selector.includes('contenteditable')?[editor]:[]},context={document:{body:root},getComputedStyle:()=>({visibility:'visible'}),URL};
 let inserts=0;return {editor,get inserts(){return inserts;},contents:{getURL:()=> 'https://chatgpt.com/',executeJavaScript:async code=>vm.runInNewContext(code,context),focus:()=>{},insertText:async text=>{inserts++;editor.value='\u200f'+text.replace(/\n/g,'\n\n')+'\u200e';}}};
}
test('the real composer guard accepts equivalent browser line breaks without changing or resending text',async()=>{
 const f=fixture(),text='کتاب «نمونه»\nاین یک روایت فارسی است.\n\nصحنهٔ بعد';await bridge.prepare(f.contents,text);assert.equal(f.inserts,1);await bridge.prepare(f.contents,text);assert.equal(f.inserts,1);assert.equal(await f.contents.executeJavaScript(bridge.script('verify',text)).then(r=>r.ready),true);
});
test('another draft is never overwritten and text cannot be inserted on a foreign origin',async()=>{
 const f=fixture('یک پیش‌نویس دیگر');await assert.rejects(bridge.prepare(f.contents,'دستور جدید'),/پیش‌نویس/);assert.equal(f.inserts,0);f.contents.getURL=()=> 'https://example.org/';await assert.rejects(bridge.prepare(f.contents,'دستور جدید'),/چت‌جی‌پی‌تی/);assert.equal(f.inserts,0);
});
test('the Send button outside the editor form is located without activating unrelated submit buttons',()=>{
 const text='دستور ساخت تصویر',form={contains:()=>false},editor={value:text,disabled:false,id:'',getClientRects:()=>[{}],getAttribute:()=> 'Ask ChatGPT',closest:selector=>selector==='form'?form:null,focus:()=>{}},send={disabled:false,type:'button',textContent:'',getClientRects:()=>[{}],getAttribute:name=>name==='aria-label'?'Send':null,getBoundingClientRect:()=>({left:200,top:500,width:40,height:40})},unrelated={...send,type:'submit',getAttribute:()=>null,getBoundingClientRect:()=>{throw Error('Wrong submit');}},root={querySelectorAll:selector=>selector==='button'?[unrelated,send]:[editor]};
 const result=vm.runInNewContext(bridge.script('send',text),{document:{body:root},getComputedStyle:()=>({visibility:'visible'}),URL});assert.equal(result.status,'button');assert.equal(result.x,220);assert.equal(result.y,520);
});
test('accessible Send works for controls outside ordinary DOM selectors and only activates that enabled button once',async()=>{
 const calls=[];let attached=false;const contents={debugger:{isAttached:()=>attached,attach:()=>{attached=true;},detach:()=>{attached=false;},sendCommand:async(method,args)=>{calls.push({method,args});if(method==='Accessibility.getFullAXTree')return {nodes:[{role:{value:'button'},name:{value:'Delete'},backendDOMNodeId:1},{role:{value:'button'},name:{value:'Send'},backendDOMNodeId:2,properties:[{name:'disabled',value:{value:true}}]},{role:{value:'button'},name:{value:'Send'},backendDOMNodeId:3}]};if(method==='DOM.getBoxModel'){assert.equal(args.backendNodeId,3);return {model:{width:40,height:40,border:[100,200,140,200,140,240,100,240]}};}return {};}}};
 assert.equal(await bridge.clickAccessibleSend(contents),true);assert.equal(attached,false);const input=calls.filter(c=>c.method==='Input.dispatchMouseEvent');assert.equal(input.length,2);assert.equal(input[0].args.x,120);assert.equal(input[0].args.y,220);assert.equal(input[1].args.type,'mouseReleased');
});
