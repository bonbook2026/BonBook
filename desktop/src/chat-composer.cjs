'use strict';
let diagnostics=()=>{};
const attachmentRuns=new WeakMap();

// This bridge only uses the rendered chat: its composer and displayed images.
// It never reads account credentials or calls private generation endpoints.
function inChat(operation,arg){
 const normalize=text=>String(text||'').normalize('NFC').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim();
 const visible=e=>Boolean(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
 const root=document.body||document;
 const editors=[...root.querySelectorAll('[contenteditable]:not([contenteditable="false"]),textarea')].filter(e=>visible(e)&&!e.disabled&&!e.closest('[role="dialog"],aside,nav'));
 const editor=editors.find(e=>e.id==='prompt-textarea')||editors.find(e=>/ask|message|chatgpt|پیام|بپرس/i.test([e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-placeholder')].join(' ')))||editors.at(-1);
 const draft=()=>editor?('value'in editor?editor.value:editor.innerText||editor.textContent||'').trim():'';
 if(operation==='attachments'){
  const scope=editor?.closest('form')||editor?.parentElement?.parentElement?.parentElement||root,inputs=[...root.querySelectorAll('input[type="file"]')],usable=inputs.map((e,index)=>({e,index})).filter(({e})=>!e.disabled&&(!e.accept||/image|\*|\.(?:png|jpe?g|webp)/i.test(e.accept))&&(arg<2||e.multiple)),input=usable.find(({e})=>scope.contains?.(e))||usable[0];
  const images=[...scope.querySelectorAll('img')].filter(e=>visible(e)&&e.naturalWidth>20),remove=[...scope.querySelectorAll('button')].filter(e=>visible(e)&&/remove (?:file|attachment|image)|حذف (?:فایل|پیوست|تصویر)/i.test(e.getAttribute('aria-label')||e.getAttribute('title')||'')),names=[...inputs].flatMap(e=>[...(e.files||[])].map(f=>f.name));
  const uploading=[...scope.querySelectorAll('[role="progressbar"],progress')].some(visible),text=scope.innerText||'';
  return {inputIndex:input?.index??-1,count:Math.max(images.length,remove.length),names,text:text.slice(0,4000),uploading};
 }
 if(operation==='focus'){
  if(!editor)return {status:'missing'};
  const text=normalize(draft());if(text&&text!==normalize(arg))return {status:'occupied'};
  editor.focus();return {status:text===normalize(arg)?'ready':'empty'};
 }
 if(operation==='verify')return {ready:Boolean(editor&&normalize(draft())===normalize(arg))};
 if(operation==='send'){
  if(!editor||normalize(draft())!==normalize(arg))return {status:'changed'};
  const buttons=[...root.querySelectorAll('button')].filter(b=>visible(b)&&!b.disabled);
  const send=buttons.find(b=>/^(send|send message|send prompt|ارسال|ارسال پیام)$/i.test((b.getAttribute('aria-label')||b.getAttribute('title')||b.textContent||'').trim()))||buttons.find(b=>b.getAttribute('data-testid')==='send-button')||buttons.find(b=>b.type==='submit'&&editor.closest('form')?.contains(b)&&!/voice|dictat|audio|صدا/i.test(b.getAttribute('aria-label')||''));
  if(send){const r=send.getBoundingClientRect();return {status:'button',x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};}
  editor.focus();return {status:'enter'};
 }
 if(operation==='scan'){
  const headings=[...root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')],userHeading=headings.filter(e=>/^(you said:|شما گفتید:?)/i.test(e.textContent.trim())).at(-1),userRole=[...root.querySelectorAll('[data-message-author-role="user"]')].at(-1),user=userRole||userHeading;
  let userText=userRole?.innerText||userRole?.textContent||'';
  if(!userRole&&userHeading){const following=headings.find(e=>Boolean(userHeading.compareDocumentPosition(e)&4)&&/^(chatgpt said:|چت.*گفت)/i.test(e.textContent.trim()));const range=document.createRange();range.setStartAfter(userHeading);if(following)range.setEndBefore(following);else range.setEndAfter(root.lastChild);userText=range.toString();}
  const messages=[...root.querySelectorAll('[data-message-author-role="assistant"]')];
  const areas=messages.length?messages:[...root.querySelectorAll('article')].filter(e=>!/user|کاربر/i.test(e.getAttribute('aria-label')||''));
  const trusted=src=>{try{const u=new URL(src);return u.protocol==='blob:'&&src.startsWith('blob:https://chatgpt.com/')||u.protocol==='https:'&&(u.hostname==='chatgpt.com'||u.hostname.endsWith('.oaiusercontent.com')||u.hostname.endsWith('.openai.com'));}catch{return false;}};
  const allImages=(areas.length?areas:[root]).flatMap(area=>[...area.querySelectorAll('img')]).filter(e=>visible(e)&&e.complete&&e.naturalWidth>=300&&e.naturalHeight>=200&&!e.closest('form,[contenteditable],aside,nav')&&(!user||!user.contains(e)&&Boolean(user.compareDocumentPosition(e)&4))&&trusted(e.currentSrc||e.src)&&(messages.length||/generated image|تصویر.*(?:تولید|ساخته)/i.test((e.alt||'')+' '+(e.closest('button')?.getAttribute('aria-label')||''))));
  const images=[...new Set(allImages.map(e=>e.currentSrc||e.src).filter(src=>/^https:\/\/|^blob:https:\/\//.test(src)))];
  const last=areas.at(-1),text=(last?.innerText||'').slice(-6000);
  const pending=[...root.querySelectorAll('button')].some(b=>visible(b)&&/^(stop generating|stop response|توقف تولید|توقف پاسخ)$/i.test((b.getAttribute('aria-label')||b.getAttribute('title')||'').trim()));
  const error=/you(?:'ve| have) (?:reached|hit)|image generation limit|too many requests|try again (?:in|later)|unable to generate|couldn.t generate|محدودیت.{0,40}(?:تصویر|درخواست)|سقف.{0,40}(?:تصویر|درخواست)/i.test(text);
  return {images,count:areas.length,pending,error,draftEmpty:!draft(),promptMatches:!arg||normalize(userText).includes(normalize(arg))};
 }
 return {};
}
const script=(operation,arg='')=>`(${inChat.toString()})(${JSON.stringify(operation)},${JSON.stringify(arg)})`;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function onChat(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='chatgpt.com';}catch{return false;}}
function conversationUrl(url){try{const u=new URL(url);return onChat(url)&&/^\/c\/[a-zA-Z0-9-]+$/.test(u.pathname)?u.origin+u.pathname:null;}catch{return null;}}
async function prepare(contents,text,files=[]){
 if(!onChat(contents.getURL()))throw Error('مرورگر داخلی را به چت‌جی‌پی‌تی برگردان و ورودت را کامل کن.');
 let result;for(let i=0;i<25;i++){result=await contents.executeJavaScript(script('focus',text));if(result.status!=='missing')break;await delay(300);}
 if(result?.status==='occupied')throw Error('کادر چت یک پیش‌نویس دیگر دارد؛ آن را ارسال یا پاک کن و ادامه را بزن.');
 if(!['ready','empty'].includes(result?.status))throw Error('کادر نوشتن چت پیدا نشد؛ صفحه را باز کن و بعد دوباره ادامه بده.');
 if(result.status==='empty'){attachmentRuns.delete(contents);contents.focus();await contents.insertText(text);}
 for(let i=0;i<5;i++){if((await contents.executeJavaScript(script('verify',text))).ready){if(files.length)await attachFiles(contents,text,files);return;}await delay(200);}
 throw Error('قرارگرفتن دستور در چت تأیید نشد؛ هیچ دستوری ارسال نشد.');
}
async function attachFiles(contents,text,files){
 if(!onChat(contents.getURL())||!Array.isArray(files)||files.length<1||files.length>3||files.some(f=>typeof f!=='string'||!require('node:path').isAbsolute(f)))throw Error('پیوست قالب معتبر نیست.');
 const key=JSON.stringify(files),previous=attachmentRuns.get(contents);let run=previous?.text===text&&previous.key===key?previous:null,state=await contents.executeJavaScript(script('attachments',files.length));
 if(!run){if(state.count)throw Error('پیوست دیگری در پیش‌نویس هست؛ برای حفظ آن، قالب جدید خودکار اضافه نشد.');if(state.inputIndex<0)throw Error('ورودی پیوست تصویر در چت پیدا نشد؛ صفحهٔ چت را کامل باز کن.');run={key,text,files,started:true,ready:false};attachmentRuns.set(contents,run);
  const debug=contents.debugger;if(!debug)throw Error('اتصال پیوست قالب آماده نیست.');const own=!debug.isAttached();if(own)debug.attach('1.3');
  try{await debug.sendCommand('DOM.enable');const {root}=await debug.sendCommand('DOM.getDocument',{depth:1}),{nodeIds}=await debug.sendCommand('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'input[type="file"]'});if(!nodeIds[state.inputIndex])throw Error('ورودی پیوست تصویر تغییر کرده است.');await debug.sendCommand('DOM.setFileInputFiles',{nodeId:nodeIds[state.inputIndex],files});}finally{if(own&&debug.isAttached())debug.detach();}
 }
 for(let i=0;i<120;i++){state=await contents.executeJavaScript(script('attachments',files.length));if(state.count>=files.length&&!state.uploading){run.ready=true;return;}await delay(500);}
 throw Error('پیوست قالب هنوز آماده نیست؛ درخواست ساخت ارسال نشد. پیوست‌های موجود حفظ شدند.');
}
async function scan(contents,prompt=''){if(!onChat(contents.getURL()))throw Error('صفحهٔ چت تغییر کرده است؛ به گفت‌وگوی همین کتاب برگرد.');return contents.executeJavaScript(script('scan',prompt));}
async function clickAccessibleSend(contents,onAttempt=()=>{}){
 const debug=contents.debugger;if(!debug)return false;const own=!debug.isAttached();
 if(own)debug.attach('1.3');
 try{
  await debug.sendCommand('Accessibility.enable');const {nodes}=await debug.sendCommand('Accessibility.getFullAXTree');
  const buttons=nodes.filter(n=>n.role?.value==='button'&&/^(send|send message|send prompt|ارسال|ارسال پیام)$/i.test(n.name?.value?.trim()||'')&&!n.properties?.some(p=>p.name==='disabled'&&p.value?.value===true)&&n.backendDOMNodeId);
  for(const button of buttons){
   let model;try{({model}=await debug.sendCommand('DOM.getBoxModel',{backendNodeId:button.backendDOMNodeId}));}catch{continue;}
   const q=model.border||model.content;if(!q||model.width<2||model.height<2)continue;
   const x=(q[0]+q[2]+q[4]+q[6])/4,y=(q[1]+q[3]+q[5]+q[7])/4;
   diagnostics({stage:'accessible-send',found:true,x:Math.round(x),y:Math.round(y)});
   onAttempt();
   await debug.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
   await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});return true;
  }
  diagnostics({stage:'accessible-send',found:false,nodes:nodes.length,sendOrVoice:nodes.filter(n=>n.role?.value==='button'&&/send|voice|ارسال/i.test(n.name?.value||'')).map(n=>n.name.value).slice(-5)});return false;
 }finally{if(own&&debug.isAttached())debug.detach();}
}
async function submit(contents,text,onAttempt=()=>{},canSend=()=>true){
 if(!onChat(contents.getURL()))throw Error('صفحهٔ چت معتبر نیست.');
 if(!(await contents.executeJavaScript(script('verify',text))).ready)throw Error('پیش‌نویس چت تغییر کرده است؛ برای جلوگیری از ارسال اشتباه، صف متوقف شد.');
 const attachments=attachmentRuns.get(contents);if(attachments?.text===text){const state=await contents.executeJavaScript(script('attachments',attachments.files.length));if(!attachments.ready||state.count<attachments.files.length||state.uploading)throw Error('قالب یا تصویرهای مرجعِ این درخواست آماده نیستند؛ برای جلوگیری از ساخت اشتباه، ارسال متوقف شد.');}
 let clicked=false;
 for(let i=0;i<30&&!clicked;i++){
  if(!canSend())throw Error('ارسال متوقف شد؛ دستور در پیش‌نویس چت حفظ شد.');
  if(!(await contents.executeJavaScript(script('verify',text))).ready)throw Error('پیش‌نویس چت تغییر کرده است؛ صف متوقف شد.');
  const mark=()=>{if(!canSend())throw Error('ارسال متوقف شد؛ دستور در پیش‌نویس حفظ شد.');onAttempt();};
  clicked=await clickAccessibleSend(contents,mark);if(clicked)break;
  const sent=await contents.executeJavaScript(script('send',text));
  if(sent.status==='button'){diagnostics({stage:'send-control',...sent,zoom:contents.getZoomFactor?.()??1});mark();contents.focus();contents.sendInputEvent({type:'mouseDown',x:sent.x,y:sent.y,button:'left',clickCount:1});contents.sendInputEvent({type:'mouseUp',x:sent.x,y:sent.y,button:'left',clickCount:1});clicked=true;break;}
  await delay(500);
 }
 if(!clicked)throw Error('دکمهٔ ارسال چت هنوز آماده نیست؛ پس از آماده‌شدن، ادامه را بزن. هیچ دکمهٔ دیگری فعال نشد.');
 // Never resend on uncertainty: the first submission may already be processing.
 for(let i=0;i<100;i++){await delay(200);const result=await scan(contents);if(result.draftEmpty){diagnostics({stage:'send-result',draftEmpty:true});return;}if(i===99)diagnostics({stage:'send-result',draftEmpty:false,messageCount:result.count});}
 throw Error('نتیجهٔ ارسال هنوز مشخص نیست؛ برای جلوگیری از دستور تکراری، چت را بررسی و ادامه را بزن.');
}
module.exports={prepare,submit,scan,attachFiles,conversationUrl,script,onChat,clickAccessibleSend,setDiagnostics:fn=>{diagnostics=fn;}};
