'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
async function readCatalog(file){
 try{if((await fs.stat(file)).size>1024*1024)return [];const rows=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(rows))return [];const seen=new Set();return rows.filter(row=>{if(!row||typeof row.id!=='string'||!/^[-0-9a-f]{36}$/i.test(row.id)||seen.has(row.id)||typeof row.directory!=='string'||!path.isAbsolute(row.directory)||typeof row.title!=='string'||row.title.length>200||!Number.isSafeInteger(row.pages)||row.pages<1||row.pages>2000||!Number.isFinite(row.updatedAt))return false;seen.add(row.id);return true;}).slice(0,80);}catch{return [];}
}
async function rememberProject(file,project,directory){
 const rows=await readCatalog(file),entry={id:project.id,title:project.book.title,pages:project.pages.length,directory:path.resolve(directory),updatedAt:Date.now()},next=[entry,...rows.filter(row=>row.id!==entry.id)].slice(0,80),temp=file+'.'+crypto.randomUUID()+'.tmp';
 await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(next,null,2));await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}return next;
}
module.exports={readCatalog,rememberProject};
