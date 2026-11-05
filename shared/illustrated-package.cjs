'use strict';
const FORMAT='bonbook.illustrated-book',VERSION=1,MAX_PAGES=2000,MAX_ASSET_BYTES=30*1024*1024;
function fail(message){throw new Error(message);}
function text(value,max,name,required=false){if(typeof value!=='string'||value.length>max||required&&!value.trim())fail(`${name} معتبر نیست.`);return value;}
function assetPath(value){return typeof value==='string'&&/^(?:images|audio)\/page-[0-9]{1,6}\.(?:png|jpg|jpeg|webp|mp3|wav|ogg|m4a|aac|flac|webm)$/.test(value);}
function validatePackage(input){
 if(!input||input.format!==FORMAT||input.version!==VERSION)fail('این فایل، بستهٔ کتاب مصور BonBook نسخهٔ ۱ نیست.');
 const b=input.book;if(!b||!Array.isArray(input.pages)||!input.pages.length||input.pages.length>MAX_PAGES)fail('بسته باید از یک تا ۲۰۰۰ صفحه داشته باشد.');
 const book={title:text(b.title,200,'عنوان کتاب',true),author:text(b.author??'',160,'نویسنده'),description:text(b.description??'',3000,'معرفی'),language:text(b.language??'fa-IR',20,'زبان',true)};
 if(!Array.isArray(input.assets)||input.assets.length>MAX_PAGES*2)fail('فهرست فایل‌های بسته معتبر نیست.');
 const assets=new Map();for(const a of input.assets){if(!a||!assetPath(a.path)||assets.has(a.path)||!Number.isSafeInteger(a.size)||a.size<12||a.size>MAX_ASSET_BYTES||typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256))fail('نام، حجم یا امضای فایل‌های بسته معتبر نیست.');assets.set(a.path,{path:a.path,size:a.size,sha256:a.sha256});}
 const numbers=new Set(),used=new Set();let previous=0;
 const pages=input.pages.map(p=>{
  if(!p||!Number.isSafeInteger(p.number)||p.number<1||p.number>100000||numbers.has(p.number)||p.number<=previous)fail('شمارهٔ صفحه‌ها باید یکتا و صعودی باشند.');numbers.add(p.number);previous=p.number;
  const content=text(p.content??'',40000,'متن صفحه'),heading=text(p.heading??'',200,'عنوان صفحه');
  for(const kind of ['image','audio'])if(p[kind]!=null){const value=p[kind];if(!assets.has(value)||!value.startsWith(kind==='image'?'images/':'audio/')||used.has(value))fail('فایلِ یکی از صفحه‌ها موجود نیست یا تکراری است.');if(kind==='image'&&!/\.(png|jpe?g|webp)$/.test(value))fail('قالب تصویر معتبر نیست.');if(kind==='audio'&&!/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/.test(value))fail('قالب صوت معتبر نیست.');used.add(value);}
  if(!content.trim()&&!p.image)fail('هر صفحه باید متن یا تصویر داشته باشد.');
  const cues=p.audioCues??[];if(!Array.isArray(cues)||cues.length>2000)fail('زمان‌بندی زیرنویس معتبر نیست.');let t=-1,o=-1;
  for(const c of cues){if(!p.audio||!Number.isFinite(c?.time)||c.time<0||c.time>86400||c.time<=t||!Number.isInteger(c.offset)||c.offset<0||c.offset>=content.length||c.offset<=o)fail('زمان‌بندی باید به ترتیب صدا و داخل متن همین صفحه باشد.');t=c.time;o=c.offset;}
  return {number:p.number,heading,content,image:p.image??null,audio:p.audio??null,audioCues:cues.map(c=>({time:c.time,offset:c.offset}))};
 });
 if(used.size!==assets.size)fail('بسته دارای فایل اضافه و استفاده‌نشده است.');
 return {format:FORMAT,version:VERSION,book,pages,assets:[...assets.values()]};
}
module.exports={FORMAT,VERSION,MAX_PAGES,MAX_ASSET_BYTES,assetPath,validatePackage};
