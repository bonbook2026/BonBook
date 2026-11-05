const {test}=require('node:test'),assert=require('node:assert/strict'),{frameGeometry,panelSpans}=require('../../shared/comic-layout.cjs'),scenes=require('../../shared/narrative-scenes.cjs');
test('all comic panels receive bounded image dimensions from their actual sheet and column span',()=>{
 for(let total=1;total<=24;total++)for(let index=0;index<total;index++){
  const frame=frameGeometry(total,index),start=Math.floor(index/7)*7;assert.equal(frame.span,panelSpans(Math.min(7,total-start))[index-start]);assert.ok(frame.width>=256&&frame.height>=256);assert.equal(Math.max(frame.width,frame.height),1536);assert.equal(frame.width%8,0);assert.equal(frame.height%8,0);
 }
 assert.ok(frameGeometry(5,0).width<frameGeometry(5,0).height);assert.ok(frameGeometry(5,2).width<frameGeometry(5,0).width);assert.ok(frameGeometry(7,0).width>frameGeometry(7,0).height);assert.deepEqual(frameGeometry(8,7),frameGeometry(1,0));
});
test('comic prompts specify matching panel dimensions, safe framing and keep original narration untouched',()=>{
 const content='متن روایت کتاب',list=Array.from({length:5},(_,i)=>({id:'s-'+i,start:0,end:content.length,shot:'wide',motion:'still'})),page={number:4,content,scenes:list},book={book:{title:'کتاب',author:''},presentation:'COMIC',style:'کمیک',characters:''};
 for(let i=0;i<list.length;i++){const frame=frameGeometry(5,i),prompt=scenes.scenePrompt(book,page,list[i]);assert.ok(prompt.includes('عرض '+frame.width+' و ارتفاع '+frame.height));assert.ok(prompt.includes(frame.width+':'+frame.height));assert.match(prompt,/۸٪ حاشیهٔ امن/);assert.ok(prompt.includes(content));assert.ok(!prompt.includes('تصویر افقی ۱۶:۹'));}
 assert.match(scenes.scenePrompt({...book,presentation:'SCENES'},page,list[0]),/تصویر افقی ۱۶:۹/);assert.equal(content,'متن روایت کتاب');
});
