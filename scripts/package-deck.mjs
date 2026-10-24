#!/usr/bin/env node
// A stored ZIP needs no npm package, Python, account, or network.
import fs from 'node:fs/promises';
import path from 'node:path';
import {checkProject,filesUnder} from '../assets/starter-deck/harness/lib.mjs';
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
export function zipStored(entries){
 const chunks=[],directory=[];let offset=0;
 const crc=buf=>{let n=0xffffffff;for(const b of buf){n^=b;for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;};
 for(const [name,data]of entries){const filename=Buffer.from(name),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt32LE(crc(data),14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt32LE(crc(data),16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);chunks.push(local,filename,data);directory.push(central,filename);offset+=local.length+filename.length+data.length;}
 const end=Buffer.alloc(22),dir=Buffer.concat(directory);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,dir,end]);
}
if(args.includes('--project'))try{
 const root=path.resolve(value('--project')),dest=path.resolve(value('--dest')||path.join(root,'handoff-source.zip'));
 try{await fs.access(dest);throw Error('Destination exists; choose a new output file.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const check=await checkProject(root);if(!check.passed)throw Error(check.errors.join('\n'));
 const entries=[];
 for(const folder of ['public','harness','server',...(args.includes('--include-notes')?['workshop']:[])]){
  const dir=path.join(root,folder);try{for(const file of await filesUnder(dir)){
   const rel=path.relative(root,file).replaceAll(path.sep,'/');if(rel.split('/').some(s=>s.startsWith('.'))||rel.endsWith('/build.json'))continue;
   entries.push([rel,await fs.readFile(file)]);
  }}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 for(const name of ['package.json','wrangler.json','qa/flows.json'])try{entries.push([name,await fs.readFile(path.join(root,name))]);}catch(e){if(e.code!=='ENOENT')throw e;}
 // Optional browser-exported edit/request data lives outside public/.
 if(args.includes('--edit')){const data=JSON.parse(await fs.readFile(path.resolve(value('--edit')),'utf8'));if(data.format!=='workshop-edit/v1')throw Error('Expected a workshop-edit/v1 file.');entries.push(['edits/workshop-edit.json',Buffer.from(JSON.stringify(data,null,2))]);}
 entries.push(['HANDOFF.txt',Buffer.from('원본 소스 묶음입니다. public/index.html은 기본 발표자료입니다. edits/workshop-edit.json이 있으면 원본을 로컬 HTTP 서버로 연 뒤 편집 > 저장·전달 > 편집본 불러오기로 반영하세요. 새 대화에는 소스와 수정 요청 파일을 함께 전달하세요. 발표 노트는 --include-notes를 지정한 경우에만 포함됩니다. 비밀 키와 실제 참여 기록은 제외됩니다.\n')]);
 for(const [name,data]of entries)if(/\.(json|js|html|md|txt)$/.test(name)&&/(sk-or-v1-[\da-z]{20,}|sk-[\da-zA-Z_-]{30,}|-----BEGIN .*PRIVATE KEY)/.test(data.toString()))throw Error(`Possible credential in ${name}; omitted value`);
 await fs.writeFile(dest,zipStored(entries),{flag:'wx'});console.log(JSON.stringify({source:dest,files:entries.length,notesIncluded:args.includes('--include-notes'),deployed:false},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
