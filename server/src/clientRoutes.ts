import express,{Express} from 'express';
import path from 'path';
import fs from 'fs';

export function installClientRoutes(app:Express,clientDirectory:string){
  if(!fs.existsSync(path.join(clientDirectory,'index.html')))throw new Error('Build the preproduction client before starting the server.');
  app.use(express.static(clientDirectory,{index:'index.html',dotfiles:'deny',etag:true,setHeaders:(res,filePath)=>{
    if(filePath.endsWith('.html'))res.setHeader('Cache-Control','no-store');
  }}));
  app.get(/^\/(?:admin(?:\/books\/\d+|\/access|\/categories|\/sections|\/library-hero)?|library|search|read\/\d+\/\d+|login|auth\/complete|dashboard|shop|profile|store|order-summary|orders|success|payment-failed)\/?$/,(_req,res)=>{
    res.setHeader('Cache-Control','no-store');res.sendFile(path.join(clientDirectory,'index.html'));
  });
}
