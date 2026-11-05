'use strict';
let current=null,tab='pages';const $=id=>document.getElementById(id),fa=n=>n.toLocaleString('fa-IR');
async function call(name,payload){const result=await window.studio.call(name,payload);render(result);return result;}
function render(s){current=s;const p=s.project;document.body.classList.toggle('full',!s.browserVisible);$('browser-toggle').textContent=s.browserVisible?'نمایش کتاب':'نمایش مرورگر';$('welcome').hidden=Boolean(p);$('workspace').hidden=!p;$('notice').hidden=!s.message;$('notice').textContent=s.message||'';$('notice').classList.toggle('error',Boolean(s.error));$('warning').hidden=!s.warning;$('warning').textContent=s.warning||'';for(const b of document.querySelectorAll('button'))b.disabled=s.busy;$('progress').hidden=!s.progress;if(s.progress){$('progress').querySelector('span').textContent=`${s.progress.label} · ${fa(s.progress.current)} از ${fa(s.progress.total)}`;$('progress').querySelector('progress').value=s.progress.current/s.progress.total*100;}
 if(!p)return;$('book-title').textContent=p.book.title;$('page-count').textContent=fa(p.pages.length);$('image-count').textContent=fa(p.pages.filter(x=>x.image).length);$('audio-count').textContent=fa(p.pages.filter(x=>x.audio).length);
 const select=$('page-select');if(select.options.length!==p.pages.length||select.dataset.project!==p.id){select.replaceChildren(...p.pages.map(x=>{const o=document.createElement('option');o.value=x.number;o.textContent=fa(x.number);return o;}));select.dataset.project=p.id;}select.value=p.selected;
 const page=p.pages.find(x=>x.number===p.selected)||p.pages[0];$('previous').disabled=s.busy||page===p.pages[0];$('next').disabled=s.busy||page===p.pages.at(-1);
 for(const [id,value]of Object.entries({title:p.book.title,author:p.book.author,description:p.book.description,style:p.style,characters:p.characters,'page-heading':page.heading,'page-content':page.content})){if(document.activeElement!==$(id))$(id).value=value;}
 $('page-image').hidden=!page.imageUrl;$('empty-image').hidden=Boolean(page.imageUrl);if(page.imageUrl&&$('page-image').getAttribute('src')!==page.imageUrl)$('page-image').src=page.imageUrl;if(!page.imageUrl)$('page-image').removeAttribute('src');
 const audio=$('page-audio');audio.hidden=!page.audioUrl;if(page.audioUrl&&audio.getAttribute('src')!==page.audioUrl){audio.src=page.audioUrl;audio.load();}if(!page.audioUrl){audio.pause();audio.removeAttribute('src');}
 $('armed').hidden=!s.armed;$('armed-label').textContent=s.armed?`دانلود بعدی ← صفحهٔ ${fa(s.armed)}`:'';
}
window.studio.onState(render);call('state');
for(const b of document.querySelectorAll('[data-action]'))b.addEventListener('click',()=>call(b.dataset.action));
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{tab=b.dataset.tab;for(const item of document.querySelectorAll('[data-tab]'))item.classList.toggle('selected',item===b);for(const id of ['pages','style','output'])$('tab-'+id).hidden=id!==tab;});
$('page-select').addEventListener('change',e=>call('select-page',Number(e.target.value)));
for(const [id,direction]of [['previous',-1],['next',1]])$(id).addEventListener('click',()=>{const p=current.project,i=p.pages.findIndex(x=>x.number===p.selected),next=p.pages[i+direction];if(next)call('select-page',next.number);});
$('save-book').addEventListener('click',()=>call('update-book',{title:$('title').value,author:$('author').value,style:$('style').value,characters:$('characters').value}));
$('save-page').addEventListener('click',()=>call('update-page',{number:current.project.selected,heading:$('page-heading').value,content:$('page-content').value}));
$('prepare-page').addEventListener('click',()=>call('prepare-prompt',{setup:false}));$('prepare-setup').addEventListener('click',()=>call('prepare-prompt',{setup:true}));
for(const kind of ['image','audio'])$('attach-'+kind).addEventListener('click',()=>call('attach-one',{kind,number:current.project.selected}));
$('replace-text').addEventListener('click',()=>call('replace-text'));
$('audio-folder').addEventListener('click',()=>call('attach-many',{kind:'audio',folder:true}));$('audio-files').addEventListener('click',()=>call('attach-many',{kind:'audio',folder:false}));$('image-folder').addEventListener('click',()=>call('attach-many',{kind:'image',folder:true}));
$('export').addEventListener('click',async()=>{const saved=await call('update-book',{description:$('description').value});if(!saved.error)call('export');});
