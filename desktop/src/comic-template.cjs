'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const sheet=require('./comic-page.cjs');
const comic=(()=>{try{return require('../shared/comic-layout.cjs');}catch{return require('../../shared/comic-layout.cjs');}})();
async function renderTemplate(project,page,folder,BrowserWindow){
 const layout=sheet.templateLayout(page.scenes.length),data={...layout,panels:layout.panels.map((r,i)=>({...r,number:i+1,text:(()=>{const text=comic.comicText(page.content,page.scenes[i]);return text.dialogue||text.narration;})()}))};
 const file=path.join(folder,'template-page-'+String(page.number).padStart(4,'0')+'-'+sheet.pageFingerprint(page).slice(0,12)+'.png');await fs.mkdir(folder,{recursive:true});
 const view=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 try{await view.loadFile(path.join(__dirname,'../ui/comic-template.html'));const dataUrl=await view.webContents.executeJavaScript('window.renderComicTemplate('+JSON.stringify(data)+')');if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/png;base64,'))throw Error('قالب تصویری صفحه آماده نشد.');await fs.writeFile(file,Buffer.from(dataUrl.slice(dataUrl.indexOf(',')+1),'base64'));return file;}finally{view.destroy();}
}
module.exports={renderTemplate};
