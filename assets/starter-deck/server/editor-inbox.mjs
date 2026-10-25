// Local, same-project handoff. No model, cloud account, file upload service, or agent process is started.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const batchOK=id=>typeof id==='string'&&/^batch-[a-f0-9]{64}$/.test(id);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const states=new Set(['pending','working','ready','done','blocked']);
const json=file=>fs.readFile(file,'utf8').then(JSON.parse);
async function directory(dir,create=false){
  if(create)await fs.mkdir(dir,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  const s=await fs.lstat(dir);if(s.isSymbolicLink()||!s.isDirectory())fail(409,'요청함 경로가 일반 폴더가 아닙니다.');return dir;
}
async function safeJSON(file){const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink())fail(409,'요청함 파일을 확인하세요.');return json(file);}
async function atomicJSON(file,data){
  const temp=file+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});await fs.rename(temp,file);}
  finally{await fs.rm(temp,{force:true});}
}

export async function openInbox(project){
  const root=await fs.realpath(project),privateDir=path.join(root,'.workshop-editor'),inbox=path.join(privateDir,'inbox');
  // Reuse the browser's trusted model and scene validators; submitted JSON is never evaluated.
  const sandbox=vm.createContext({URL,window:{},document:{readyState:'loading',addEventListener(){}}});
  for(const file of ['config.js','scene-runtime.js','deck-model.js'])vm.runInContext(await fs.readFile(path.join(root,'public',file),'utf8'),sandbox,{timeout:1000});
  const deckId=sandbox.window.WORKSHOP_CONFIG.deckId,html=await fs.readFile(path.join(root,'public/index.html'),'utf8');
  sandbox.templates=[...html.matchAll(/<section\b[^>]*>/gi)].map(m=>m[0]).filter(s=>/\bclass=["'][^"']*\bslide\b/.test(s)).map(s=>s.match(/\bid=["']([^"']+)/)?.[1]).filter(Boolean);
  const model=doc=>{sandbox.incoming=doc;try{return structuredClone(vm.runInContext('window.WorkshopModel.validate(incoming,new Map(templates.map(id=>[id,true])))',sandbox,{timeout:1000}));}finally{delete sandbox.incoming;}};
  async function dirs(create=false){await directory(privateDir,create);await directory(inbox,create);}
  async function locate(id){if(!batchOK(id))fail(400,'요청 묶음 ID가 올바르지 않습니다.');await dirs();return directory(path.join(inbox,id));}
  async function read(id){const dir=await locate(id),batch=await safeJSON(path.join(dir,'request.json')),status=await safeJSON(path.join(dir,'status.json'));return {batch,status};}
  async function locked(id,fn){const dir=await locate(id),lock=path.join(dir,'.lock');let handle;try{handle=await fs.open(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')fail(409,'다른 작업이 이 요청 묶음을 갱신 중입니다.');throw e;}try{return await fn(dir);}finally{await handle.close();await fs.unlink(lock);}}
  function envelope(input){
    if(input?.format!=='workshop-editor-inbox/v1')fail(400,'지원하지 않는 요청함 형식입니다.');
    const document=model(input.document),requests=input.requests;
    if(!Array.isArray(requests)||!requests.length||requests.length>100)fail(400,'요청은 1~100개입니다.');
    const ids=new Set();
    for(const r of requests){const c=r.context;if(typeof r.id!=='string'||r.id.length>120||ids.has(r.id)||typeof r.request!=='string'||!r.request.trim()||r.request.length>10000||typeof r.trigger!=='string'||r.trigger.length>100||c?.deckId!==deckId||!Number.isInteger(c.revision)||c.revision<0||c.revision>document.revision||!c.page?.id||!c.object?.id)fail(400,'요청 문맥 또는 버전이 올바르지 않습니다.');ids.add(r.id);}
    return {document,requests};
  }
  async function save(input){
    const payload=envelope(input),id='batch-'+crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');await dirs(true);
    try{const existing=await read(id);return {id,duplicate:true,...existing};}catch(e){if(e.code!=='ENOENT')throw e;}
    const temp=await fs.mkdtemp(path.join(inbox,'.pending-')),createdAt=new Date().toISOString();
    const batch={format:'workshop-editor-inbox/v1',id,deckId,baseRevision:payload.document.revision,createdAt,...payload};
    const status={state:'pending',updatedAt:createdAt,note:'프로젝트 요청함에 저장됨. 에이전트 실행은 별도입니다.'};
    try{await atomicJSON(path.join(temp,'request.json'),batch);await atomicJSON(path.join(temp,'status.json'),status);
      try{await fs.rename(temp,path.join(inbox,id));}catch(e){if(!['EEXIST','ENOTEMPTY'].includes(e.code))throw e;const existing=await read(id);return{id,duplicate:true,...existing};}
    }finally{await fs.rm(temp,{recursive:true,force:true});}
    return {id,duplicate:false,batch,status};
  }
  async function list(all=false){
    try{await dirs();}catch(e){if(e.code==='ENOENT')return [];throw e;}
    const entries=[];for(const name of await fs.readdir(inbox)){if(!batchOK(name))continue;const {batch,status}=await read(name);if(all||status.state!=='done')entries.push({id:name,deckId:batch.deckId,baseRevision:batch.baseRevision,createdAt:batch.createdAt,count:batch.requests.length,...status});}
    return entries.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  }
  async function status(id,state,note='',expected){
    if(!states.has(state)||typeof note!=='string'||note.length>2000)fail(400,'처리 상태가 올바르지 않습니다.');
    return locked(id,async dir=>{const prior=await safeJSON(path.join(dir,'status.json'));if(expected&&prior.state!==expected)fail(409,'처리 상태가 바뀌었습니다. 다시 확인하세요.');if(state==='ready')await safeJSON(path.join(dir,'patch.json'));const next={state,note,updatedAt:new Date().toISOString()};await atomicJSON(path.join(dir,'status.json'),next);return next;});
  }
  function validatePatch(batch,patch){
    if(patch?.deckId!==batch.deckId||patch.baseRevision!==batch.baseRevision||!Array.isArray(patch.changes)||patch.changes.length>100||patch.pageUpdates!==undefined&&!Array.isArray(patch.pageUpdates))fail(409,'변경안의 덱 또는 기준 버전이 다릅니다.');
    const next=structuredClone(batch.document);
    for(const c of patch.changes){const o=next.pages.find(p=>p.id===c.pageId)?.objects.find(o=>o.id===c.objectId&&!o.deleted);if(!o||!c.set||Object.keys(c.set).some(k=>!['content','style','behavior'].includes(k)))fail(400,'변경안 대상 또는 필드가 올바르지 않습니다.');for(const [k,v]of Object.entries(c.set))o[k]=k==='content'?v:{...o[k],...v};}
    for(const u of patch.pageUpdates||[]){const p=next.pages.find(p=>p.id===u.pageId);if(!p||Object.keys(u).some(k=>!['pageId','notes','seconds'].includes(k)))fail(400,'페이지 변경안이 올바르지 않습니다.');for(const k of ['notes','seconds'])if(u[k]!==undefined)p[k]=u[k];}
    model(next);return patch;
  }
  async function result(id,patch){return locked(id,async dir=>{const {batch,status}=await read(id);if(!['pending','working','blocked'].includes(status.state))fail(409,'이미 변경안을 등록했거나 완료한 묶음입니다.');validatePatch(batch,patch);await atomicJSON(path.join(dir,'patch.json'),patch);const next={state:'ready',updatedAt:new Date().toISOString(),note:'변경안이 준비됐습니다. 편집기에서 미리 보고 확정하세요.'};await atomicJSON(path.join(dir,'status.json'),next);return next;});}
  async function view(id){const {batch,status}=await read(id);return {id,deckId:batch.deckId,baseRevision:batch.baseRevision,status,...(status.state==='ready'?{patch:validatePatch(batch,await safeJSON(path.join(await locate(id),'patch.json')))}:{})};}
  async function applied(id,revision){return locked(id,async dir=>{const {batch,status}=await read(id);if(status.state==='done'&&status.appliedRevision===revision)return status;if(status.state!=='ready'||revision!==batch.baseRevision+1)fail(409,'반영한 버전이 변경안과 다릅니다.');const next={state:'done',updatedAt:new Date().toISOString(),appliedRevision:revision,note:'사용자가 편집기에서 변경안을 확인하고 확정했습니다.'};await atomicJSON(path.join(dir,'status.json'),next);return next;});}
  return {root,deckId,save,list,read,status,result,view,applied,location:id=>path.posix.join('.workshop-editor/inbox',id,'request.json')};
}

export async function inboxHandler(project){
  const store=await openInbox(project),token=crypto.randomBytes(32).toString('hex');let serial=Promise.resolve();
  const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
  async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'JSON 요청만 가능합니다.');const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>16000000)fail(413,'요청함은 묶음당 16MB 이하입니다. 이미지를 줄여 주세요.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'JSON 요청이 필요합니다.');}}
  return (req,res,url)=>{
    if(!url.pathname.startsWith('/api/editor-inbox'))return false;
    const job=async()=>{try{
      const host=req.headers.host,port=req.socket.localPort;if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==`http://${host}`)fail(403,'같은 로컬 편집기에서만 요청할 수 있습니다.');
      if(url.pathname==='/api/editor-inbox'&&req.method==='GET')return send(res,200,{available:true,deckId:store.deckId,token,location:'.workshop-editor/inbox'});
      if(req.headers['x-workshop-editor-token']!==token)fail(403,'로컬 요청함 연결을 다시 확인하세요.');
      if(url.pathname==='/api/editor-inbox/batches'&&req.method==='POST'){const saved=await store.save(await body(req));return send(res,saved.duplicate?200:201,{id:saved.id,status:saved.status,duplicate:saved.duplicate,location:store.location(saved.id)});}
      const match=url.pathname.match(/^\/api\/editor-inbox\/batches\/(batch-[a-f0-9]{64})$/);
      if(match&&req.method==='GET')return send(res,200,await store.view(match[1]));
      const accepted=url.pathname.match(/^\/api\/editor-inbox\/batches\/(batch-[a-f0-9]{64})\/applied$/);
      if(accepted&&req.method==='POST')return send(res,200,{status:await store.applied(accepted[1],(await body(req)).revision)});
      fail(404,'지원하지 않는 요청함 경로입니다.');
    }catch(e){send(res,e.status||(e.code==='ENOENT'?404:400),{error:e.status?e.message:'요청함을 처리하지 못했습니다. 프로젝트 폴더와 편집본을 확인하세요.'});}};
    serial=serial.then(job,job);return true;
  };
}

if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];},command=args[0]||'list';
  try{const store=await openInbox(path.resolve(value('--project')||path.join(path.dirname(fileURLToPath(import.meta.url)),'..')));let result;
    if(command==='list')result=await store.list(args.includes('--all'));
    else if(command==='read'){result=await store.read(args[1]);if(!args.includes('--full'))result=JSON.parse(JSON.stringify({...result,snapshotFile:store.location(args[1])},(k,v)=>typeof v==='string'?v.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi,'embedded-image: 디스크 스냅샷 참조'):v));}
    else if(command==='status')result=await store.status(args[1],value('--state'),value('--note')||'',value('--expect'));
    else if(command==='result'){if(!value('--patch'))throw Error('--patch JSON 파일이 필요합니다.');result=await store.result(args[1],await json(path.resolve(value('--patch'))));}
    else throw Error('명령: list [--all], read <id>, status <id> --state working|done|blocked [--expect pending], result <id> --patch <file.json>');
    console.log(JSON.stringify(result,null,2));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
