import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {createReadStream,existsSync} from 'node:fs';
import {resolve} from 'node:path';
// An isolated local design preview. Never serves the private PDF, credentials or database.
export default defineConfig({plugins:[react(),{name:'journey-local-book-samples',configureServer(server){server.middlewares.use((req,res,next)=>{
  const match=req.url?.match(/^\/api\/media\/journey-page-(11|12)$/);
  if(!match){next();return;}
  const path=resolve(process.cwd(),`../build/page-previews/b5cec093-7e8d-4f44-8168-77d2dcec6b60-${match[1]}.png`);
  if(!existsSync(path)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');createReadStream(path).pipe(res);
});}}],server:{host:'127.0.0.1',port:3152,strictPort:true,allowedHosts:['journey.localhost']}});
