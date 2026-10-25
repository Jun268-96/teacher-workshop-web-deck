import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {initial,hash,actor,view,join,apply,fail} from './model.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export async function startEconomy({port=8798,dataDir=path.join(here,'.economy-data'),publicDir=path.join(here,'public'),teacherToken=process.env.ECONOMY_TEACHER_KEY||crypto.randomBytes(32).toString('hex')}={}){
 if(typeof teacherToken!=='string'||!/^[a-f0-9]{64}$/.test(teacherToken))throw Error('교사 키는 무작위 64자리 16진수여야 합니다.');
 await fs.mkdir(dataDir,{recursive:true,mode:0o700});const file=path.join(dataDir,'state.json');let state;try{state=JSON.parse(await fs.readFile(file,'utf8'));if(state.schema!==1||state.teacherHash!==hash(teacherToken))throw Error('저장된 체험과 교사 키가 다릅니다. 기존 데이터를 보존했습니다.');}catch(e){if(e.code!=='ENOENT')throw e;state=initial(hash(teacherToken));}
 let serial=Promise.resolve();const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(JSON.stringify(body));};
 async function persist(next){const temp=file+'.tmp';await fs.writeFile(temp,JSON.stringify(next),{mode:0o600});await fs.rename(temp,file);state=next;}
 const server=http.createServer((req,res)=>{
  const work=async()=>{try{
   const url=new URL(req.url,'http://local');
   if(url.pathname.startsWith('/api/')){
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)fail(403,'다른 사이트에서 요청할 수 없습니다.');
    if(!['GET','POST'].includes(req.method))fail(405,'지원하지 않는 요청입니다.');
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,view(state,actor(state,token)));
    if(req.method!=='POST')fail(404,'경로를 확인하세요.');if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'JSON 요청이 필요합니다.');
    let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>8192)fail(413,'요청이 너무 큽니다.');chunks.push(part);}let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'요청 형식을 확인하세요.');}
    const next=structuredClone(state);
    if(url.pathname==='/api/join'){const p=join(next,token);await persist(next);return send(res,200,view(state,{teacher:false,person:state.people.find(x=>x.id===p.id)}));}
    if(url.pathname==='/api/action'){const a=actor(next,token),result=apply(next,a,body);if(!result.duplicate)await persist(next);const role=actor(state,token);return send(res,200,{...view(state,role),duplicate:result.duplicate===true});}
    fail(404,'경로를 확인하세요.');
   }
   if(req.method!=='GET')fail(405,'GET만 가능합니다.');const raw=decodeURIComponent(url.pathname),rel=raw.endsWith('/')?raw+'index.html':raw;if(rel.split('/').some(p=>p.startsWith('.')))fail(404,'없음');const base=await fs.realpath(publicDir),requested=path.resolve(base,'.'+rel);if(!requested.startsWith(base+path.sep))fail(404,'없음');const actual=await fs.realpath(requested);if(!actual.startsWith(base+path.sep))fail(404,'없음');const data=await fs.readFile(actual),type={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2'}[path.extname(actual)]||'application/octet-stream';res.writeHead(200,{'content-type':type,'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'});res.end(data);
  }catch(e){send(res,e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:'저장하지 못했습니다. 연결을 확인하고 같은 요청으로 다시 시도해 주세요.'});}};
  serial=serial.then(work,work);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});const url=`http://127.0.0.1:${server.address().port}`;
 return {server,url,teacherToken,teacherUrl:url+'/teacher/#key='+teacherToken,studentUrl:url+'/student/',dataDir};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const keyFile=path.join(here,'.economy-data/teacher-key');await fs.mkdir(path.dirname(keyFile),{recursive:true,mode:0o700});let key=process.env.ECONOMY_TEACHER_KEY;try{key||=await fs.readFile(keyFile,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}if(!key){key=crypto.randomBytes(32).toString('hex');await fs.writeFile(keyFile,key,{flag:'wx',mode:0o600});}
 const app=await startEconomy({port:Number(process.env.PORT)||8798,teacherToken:key});console.log(JSON.stringify({url:app.url,teacherUrl:app.teacherUrl,studentUrl:app.studentUrl,localOnly:true,deployed:false}));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.server.close(()=>process.exit(0)));
}
