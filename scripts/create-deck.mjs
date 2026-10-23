#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
const value=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
try {
  if(!value('--dest')) throw new Error('Usage: node scripts/create-deck.mjs --dest <new-folder> [--name <cloudflare-worker-name>]');
  const target=path.resolve(value('--dest')),name=value('--name');
  if(name && !/^[a-z][a-z0-9-]{1,62}$/.test(name)) throw new Error('Use a lowercase Worker name, 2–63 characters.');
  try { await fs.access(target); throw new Error('Destination already exists. Choose a new directory; existing work is never overwritten.'); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
  const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/starter-deck');
  await fs.cp(source,target,{recursive:true,errorOnExist:true,force:false});
  if(name) {
    await fs.writeFile(path.join(target,'wrangler.json'),JSON.stringify({name,compatibility_date:'2026-10-01',assets:{directory:'./public'},workers_dev:true},null,2)+'\n');
    const config=path.join(target,'public/config.js');
    await fs.writeFile(config,(await fs.readFile(config,'utf8')).replace('deckId: "vanollim-workshop"',`deckId: ${JSON.stringify(name)}`));
  }
  console.log(JSON.stringify({created:target,brand:'반올림 디지털 스쿨',deploymentTarget:name||null,next:'Read workshop/ brief, adapt public/, then run node harness/harness.mjs doctor. Nothing has been installed or deployed.'},null,2));
} catch(error) { console.error(error.message);process.exitCode=1; }
