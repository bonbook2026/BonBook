'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const calls=['state','demo-project','new-project','open-project','update-book','update-page','select-page','replace-text','attach-one','attach-many','prepare-prompt','reference-text','arm-download','cancel-download','browser','external-browser','open-folder','export','preview'];
contextBridge.exposeInMainWorld('studio',{call:(name,payload)=>{if(!calls.includes(name))return Promise.reject(Error('Unknown action'));return ipcRenderer.invoke('studio:'+name,payload);},onState:fn=>{const listener=(_event,data)=>fn(data);ipcRenderer.on('studio:state',listener);return()=>ipcRenderer.removeListener('studio:state',listener);}});
