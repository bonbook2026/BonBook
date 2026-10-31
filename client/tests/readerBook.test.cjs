const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const utils={exports:{}};vm.runInNewContext(compile('utils/pageLineFocus.ts'),utils);
const spreadUtils={exports:{}};vm.runInNewContext(compile('utils/readingSpread.ts'),spreadUtils);
test('continuous reading holds right then left, turns only beyond the pair and skips sheets without a recording',()=>{
 const {advanceReadingSpread}=spreadUtils.exports,page=number=>({bookId:5,number});
 const right=page(12),left=page(13);let held=advanceReadingSpread(null,right,left,13,true);
 assert.equal(held.right,right);assert.equal(held.left,left);assert.equal(advanceReadingSpread(held,right,left,13,true),held);
 assert.equal(advanceReadingSpread(held,left,page(14),14,true),null);
 held=advanceReadingSpread(null,page(14),page(15),15,true);assert.equal(held.right.number,14);assert.equal(held.left.number,15);
 assert.equal(advanceReadingSpread(held,page(15),page(16),16,true),null);
 assert.equal(advanceReadingSpread(null,right,page(14),13,true),null);
 assert.equal(advanceReadingSpread(null,right,left,13,false),null);
 assert.equal(advanceReadingSpread(null,right,{bookId:6,number:13},13,true),null);
 assert.equal(advanceReadingSpread(null,page(23),page(25),25,true).right.number,23);
});
function fixture(){
 const slots=[],effects=[],calls=[];let cursor=0;
 const react={useRef:initial=>{const i=cursor++;return slots[i]||(slots[i]={current:initial});},useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect:fn=>effects.push(fn),useLayoutEffect:fn=>effects.push(fn)};
 const jsx=(type,props)=>({type,props}),context={exports:{},window:{matchMedia:()=>({matches:false}),setTimeout:()=>1,clearTimeout(){}},require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='../utils/pageLineFocus'?utils.exports:name==='../services/api'?{mediaUrl:url=>url}:{}};
 vm.runInNewContext(compile('components/ReaderBook.tsx'),context);
 const page=number=>({bookId:5,number,content:'متن کتاب',sourceImageUrl:'/private/page-'+number,audioUrl:'/private/voice-'+number});
 const word={start:0,end:3,time:4,endTime:5,rects:[{x:.4,y:.2,width:.1,height:.03}]};
 const defaults={page:page(12),facing:page(13),hasFacing:true,title:'کتاب',single:false,words:[word],facingWords:[word],onZoom:()=>calls.push('zoom'),onFacing:()=>calls.push('turn'),onReadWord:(w,p)=>calls.push({word:w,page:p.number})};
 const render=props=>{cursor=0;const tree=context.exports.ReaderBook({...defaults,...props});while(effects.length)effects.shift()();return tree;};
 const find=(tree,part)=>{if(!tree||typeof tree!=='object')return null;if(tree.props?.className?.split(' ').includes(part))return tree;for(const child of [tree.props?.children].flat()){const found=find(child,part);if(found)return found;}return null;};
 const event=(x=450,y=215,detail=1)=>({clientX:x,clientY:y,detail,currentTarget:{querySelector:()=>({width:1000,height:1000,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000})})}});
 const tap=(button,x,y)=>{button.props.onPointerDown(event(x,y));button.props.onClick(event(x,y));};
 return {render,find,event,tap,calls,page,word,slots};
}
test('touches on an unloaded, unmatched or untimed facing sheet never turn the book',()=>{
 for(const facingWords of [undefined,[],[{start:0,end:3,rects:[{x:.4,y:.2,width:.1,height:.03}]}]]){
  const f=fixture(),tree=f.render({facingWords}),left=f.find(tree,'rx-facing-page');f.tap(left,450,215);f.tap(left,100,800);
  assert.equal(f.calls.includes('turn'),false);assert.equal(f.calls.includes('zoom'),false);assert.equal(f.calls.length,2);assert.equal(f.calls[0].page,13);assert.equal(f.calls[1].word,null);
 }
});
test('a word touch keeps its original sheet and word even if the follow camera moves before release',()=>{
 const f=fixture(),tree=f.render(),left=f.find(tree,'rx-facing-page'),down=f.event();left.props.onPointerDown(down);
 left.props.onClick({...f.event(),currentTarget:{querySelector:()=>({width:1000,height:1000,getBoundingClientRect:()=>({left:0,top:300,width:1000,height:1000})})}});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].word,f.word);assert.equal(f.calls[0].page,13);
});
test('swipes and canceled touches do not become word reads or page clicks',()=>{
 const f=fixture(),left=f.find(f.render(),'rx-facing-page');left.props.onPointerDown(f.event());left.props.onClick(f.event(550,215));
 left.props.onPointerDown(f.event());left.props.onPointerCancel();left.props.onClick(f.event());assert.equal(f.calls.length,0);
});
test('reading the left sheet leaves both physical pages in place without a turn animation',()=>{
 const f=fixture();f.render();const tree=f.render({page:f.page(13),facing:f.page(12),activeOnLeft:true});
 assert.ok(tree.props.className.includes('rx-active-left'));assert.equal(f.find(tree,'rx-current-page').props['data-page-number'],13);assert.equal(f.find(tree,'rx-facing-page').props['data-page-number'],12);assert.equal(f.find(tree,'rx-turning-leaf'),null);
 const again=f.render({page:f.page(12),facing:f.page(13)});assert.equal(f.find(again,'rx-turning-leaf'),null);
});
test('single-sheet mode shows the active page and the eye camera centers the active left sheet',()=>{
 const f=fixture(),tree=f.render({page:f.page(13),facing:f.page(12),activeOnLeft:true,single:true});assert.ok(!tree.props.className.includes('rx-active-left'));assert.equal(f.find(tree,'rx-current-page').props['data-page-number'],13);
 const {bookFocusTransform}=utils.exports;assert.ok(bookFocusTransform(false,null,1,true).startsWith('translate(-6.25%,'));assert.equal(bookFocusTransform(true,null,1,true),bookFocusTransform(true,null));
});
test('keyboard activation of the facing sheet does not accidentally navigate, while current-page zoom remains available',()=>{
 const f=fixture(),tree=f.render();f.find(tree,'rx-facing-page').props.onClick(f.event(0,0,0));assert.equal(f.calls[0].page,13);assert.equal(f.calls[0].word,null);
 f.find(tree,'rx-current-page').props.onClick(f.event(0,0,0));assert.equal(f.calls[1],'zoom');
});
test('left-word reading preserves the spread before navigation and while the new recording is still loading',()=>{
 const f=fixture(),pages=[12,13,14].map(f.page),book={id:5,title:'کتاب',language:'fa-IR',pageCount:3,pages:pages.map(p=>({number:p.number,hasAudio:true}))};
 const slots=[book,pages[0],pages[1]],routes=[];let cursor=0,number=12;
 const audio={mode:'page',status:'idle',target:null,playlist:null,rate:1,position:0,elapsedSeconds:0,offset:-1,stop(){},playBook(){this.mode='book';this.status='loading';this.target=null;this.playlist={bookId:5,index:1,total:3,completed:false};return Promise.resolve();}};
 const react={useRef:initial=>{const i=cursor++;return slots[i]||(slots[i]={current:initial});},useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect(){}};
 const jsx=(type,props)=>({type,props}),context={exports:{},localStorage:{getItem:()=>null},window:{matchMedia:()=>({matches:true})},require:name=>{
  if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name==='react-router-dom')return {useParams:()=>({bookId:'5',page:String(number)}),useLocation:()=>({key:'test'}),useNavigate:()=>url=>routes.push(url)};
  if(name==='../components/ReaderProtection')return {useReaderProtection(){}};
  if(name==='../hooks/useSiteFeatures')return {useSiteFeatures:()=>({canAccess:()=>false})};
  if(name==='../hooks/useAuth')return {useAuth:()=>({user:null})};
  if(name==='../hooks/useTheme')return {useTheme:()=>({theme:'night'})};
  if(name==='../hooks/useNarration')return {useNarration:()=>audio};
  if(name==='../hooks/usePageLineMap')return {usePageLineMap:()=>({status:'ready',words:[f.word],lines:[]})};
  if(name==='../components/ReaderBook')return {ReaderBook:'ReaderBook',readerPageImage:()=>true};
  if(name==='../utils/bookAudioQueue')return {recordedPages:rows=>rows.filter(p=>p.hasAudio).map(p=>p.number)};
  if(name==='../utils/pageLineFocus')return utils.exports;return {};
 }};
 vm.runInNewContext(compile('pages/ReaderExperience.tsx'),context);
 const find=tree=>{if(!tree||typeof tree!=='object')return null;if(tree.type==='ReaderBook')return tree.props;for(const child of [tree.props?.children].flat()){const found=find(child);if(found)return found;}return null;};
 const render=()=>{cursor=0;return find(context.exports.Reader());};
 const first=render();first.onReadWord(f.word,pages[1]);
 const pendingRoute=render();assert.equal(pendingRoute.page.number,12);assert.equal(pendingRoute.facing.number,13);assert.equal(pendingRoute.activeOnLeft,false);assert.equal(routes.at(-1),'/read/5/13');
 number=13;const loadingAudio=render();assert.equal(loadingAudio.page.number,13);assert.equal(loadingAudio.facing.number,12);assert.equal(loadingAudio.activeOnLeft,true);
 audio.target={bookId:5,number:13,page:pages[1]};const playingLeft=render();assert.equal(playingLeft.page.number,13);assert.equal(playingLeft.facing.number,12);
 playingLeft.onReadWord(f.word,pages[0]);number=12;const back=render();assert.equal(back.page.number,12);assert.equal(back.facing.number,13);assert.equal(back.activeOnLeft,false);
});
