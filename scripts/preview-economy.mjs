#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),value=k=>{const n=args.indexOf(k);return n<0?undefined:args[n+1];};
try{
 if(!value('--dest'))throw Error('Usage: node scripts/preview-economy.mjs --dest <new-folder> [--serve --port 8798]');const dest=path.resolve(value('--dest')),port=Number(value('--port')||8798);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port.');
 try{await fs.access(dest);throw Error('Destination exists. Existing work is preserved.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.mkdir(dest,{recursive:true});await fs.cp(path.join(repo,'assets/economy-lab'),dest,{recursive:true});await fs.mkdir(path.join(dest,'public/assets'),{recursive:true});await fs.cp(path.join(repo,'assets/starter-deck/public/assets/fonts'),path.join(dest,'public/assets/fonts'),{recursive:true});
 let launched={};if(args.includes('--serve')){const {startEconomy}=await import(pathToFileURL(path.join(dest,'server.mjs')).href),key=crypto.randomBytes(32).toString('hex');await fs.mkdir(path.join(dest,'.economy-data'),{mode:0o700});await fs.writeFile(path.join(dest,'.economy-data/teacher-key'),key,{mode:0o600,flag:'wx'});const app=await startEconomy({port,teacherToken:key});launched={url:app.url,teacherUrl:app.teacherUrl,studentUrl:app.studentUrl};for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.server.close(()=>process.exit(0)));}
 console.log(JSON.stringify({created:dest,...launched,localOnly:true,deployed:false,productionDeckChanged:false}));
}catch(e){console.error(e.message);process.exitCode=1;}
