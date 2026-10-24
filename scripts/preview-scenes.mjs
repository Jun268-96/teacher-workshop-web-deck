#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {serve} from '../assets/starter-deck/harness/lib.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),value=k=>{const n=args.indexOf(k);return n<0?undefined:args[n+1];};
try{
 if(!value('--dest'))throw Error('Usage: node scripts/preview-scenes.mjs --dest <new-folder> [--serve --port 8794] [--recommend reveal,compare]');
 const dest=path.resolve(value('--dest')),port=Number(value('--port')||0);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port.');
 const text=await fs.readFile(path.join(repo,'assets/scene-lab/catalog.js'),'utf8'),catalog=JSON.parse(text.slice(text.indexOf('=')+1).trim().replace(/;$/,'')),recommended=(value('--recommend')||'').split(',').filter(Boolean);if(recommended.some(id=>!catalog.scenes.some(s=>s.id===id)))throw Error('Unknown scene ID. Read assets/scene-lab/catalog.js.');
 try{await fs.access(dest);throw Error('Destination exists. Choose a new preview folder; existing work is preserved.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.mkdir(dest,{recursive:true});await fs.cp(path.join(repo,'assets/scene-lab'),path.join(dest,'public'),{recursive:true});await fs.mkdir(path.join(dest,'public/assets'),{recursive:true});await fs.cp(path.join(repo,'assets/starter-deck/public/assets/fonts'),path.join(dest,'public/assets/fonts'),{recursive:true});await fs.copyFile(path.join(repo,'assets/starter-deck/public/assets/favicon.svg'),path.join(dest,'public/assets/favicon.svg'));
 const query=recommended.length?'?recommend='+recommended.map(encodeURIComponent).join(','):'';
 let url=null;if(args.includes('--serve')){const server=await serve(dest,port);url=server.url+query;for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.server.close(()=>process.exit(0)));}
 console.log(JSON.stringify({created:dest,entry:path.join(dest,'public/index.html'),url,sceneCount:catalog.scenes.length,recommended,productionDeckCreated:false,installed:false,deployed:false,next:'Read references/scene-discovery.md. These are generic previews; confirm the complete page plan before producing a workshop.'},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
