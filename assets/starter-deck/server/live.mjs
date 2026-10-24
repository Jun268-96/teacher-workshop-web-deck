import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const token=()=>crypto.randomBytes(32).toString('hex');
const digest=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const types=new Set(['poll','wordcloud','qa','branch','closing']);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export async function startLive({port=8792,host='127.0.0.1',dataDir=path.resolve('.workshop-data'),operatorKey=process.env.WORKSHOP_OPERATOR_KEY||token(),publicDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public')}={}) {
  await fs.mkdir(dataDir,{recursive:true,mode:0o700}); const file=path.join(dataDir,'runs.json');
  let store={runs:[]};try{store=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  let serial=Promise.resolve();
  const save=async()=>{const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(store),{mode:0o600});await fs.rename(tmp,file);};
  const text=(v,max=500)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(400,'입력 길이를 확인하세요.');return v.trim();};
  function blocks(input){if(!Array.isArray(input)||input.length<1||input.length>30)fail(400,'활동은 1~30개입니다.');const ids=new Set();return input.map((b,i)=>{if(!types.has(b.type))fail(400,'지원하지 않는 활동입니다.');const id=b.id||`block-${i+1}`;if(!/^[\w-]{1,80}$/.test(id)||ids.has(id))fail(400,'활동 ID가 올바르지 않습니다.');ids.add(id);const options=['poll','branch'].includes(b.type)?b.options:[];if(!Array.isArray(options)||options.length>12||(['poll','branch'].includes(b.type)&&options.length<2))fail(400,'선택지는 2~12개입니다.');return{id,type:b.type,title:text(b.title,200),options:options.map(o=>text(o,100)),outcomes:b.type==='branch'?options.map((_,i)=>text(b.outcomes?.[i]||'이 선택을 함께 살펴봅니다.',1000)):[],open:false,reveal:false};});}
  const headerToken=req=>(req.headers.authorization||'').replace(/^Bearer /,'');
  function auth(req,run,hostOnly=false) {const h=digest(headerToken(req));if(h===run.hostHash)return{host:true};if(hostOnly)fail(403,'진행자 권한이 필요합니다.');const participant=run.participants.find(p=>p.hash===h);if(!participant)fail(401,'다시 입장해 주세요.');return{host:false,id:participant.id};}
  function snapshot(run,role){const responses=run.responses.filter(r=>role.host||(!r.hidden&&run.blocks.find(b=>b.id===r.blockId)?.reveal));return {code:run.code,title:run.title,revision:run.revision,active:run.active,ended:run.ended,expiresAt:run.expiresAt,participantCount:run.participants.length,blocks:run.blocks.map(b=>({...b,outcomes:role.host||b.reveal?b.outcomes:[]})),responses:responses.map(r=>({id:r.id,blockId:r.blockId,value:r.value,hidden:r.hidden,status:r.status,votes:r.voters.length,...(role.host?{participantId:r.participantId}:{})})),mine:role.host?[]:run.responses.filter(r=>r.participantId===role.id).map(r=>({id:r.id,blockId:r.blockId,value:r.value})),voted:role.host?[]:run.responses.filter(r=>r.voters.includes(role.id)).map(r=>r.id)};}
  async function read(req){const parts=[];let length=0;for await(const p of req){length+=p.length;if(length>32768)fail(413,'요청이 너무 큽니다.');parts.push(p);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{fail(400,'JSON 요청이 필요합니다.');}}
  const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
  async function api(req,res,url){
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)fail(403,'다른 사이트의 요청은 허용되지 않습니다.');
    if(req.method!=='GET'&&!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'JSON 요청만 가능합니다.');
    const parts=url.pathname.split('/').filter(Boolean),body=req.method==='GET'?{}:await read(req);
    if(url.pathname==='/api/runs'&&req.method==='POST'){
      if(digest(headerToken(req))!==digest(operatorKey))fail(403,'서버 운영 키가 필요합니다.');
      let code;do{code=crypto.randomBytes(4).toString('hex').toUpperCase();}while(store.runs.some(r=>r.code===code));
      const hostToken=token(),run={code,title:text(body.title,200),hostHash:digest(hostToken),revision:1,blocks:blocks(body.blocks),active:body.blocks[0].id||'block-1',participants:[],responses:[],ended:false,expiresAt:Date.now()+14*86400000};store.runs.push(run);await save();return send(res,201,{code,hostToken});
    }
    const run=store.runs.find(r=>r.code===parts[2]);if(!run)fail(404,'회차를 찾을 수 없습니다.');
    if(run.expiresAt<Date.now()){store.runs=store.runs.filter(r=>r!==run);await save();fail(410,'보존 기간이 끝났습니다.');}
    if(parts[3]==='join'&&req.method==='POST'){
      if(run.ended)fail(410,'종료한 연수입니다.');if(run.participants.length>=500)fail(409,'참여 인원이 가득 찼습니다.');
      const participantToken=token(),id=crypto.randomUUID();run.participants.push({id,hash:digest(participantToken)});run.revision++;await save();return send(res,201,{participantToken,id});
    }
    const role=auth(req,run,req.method!=='GET'&&['control','moderate','end','reset'].includes(parts[3]));
    if(req.method==='GET'&&parts.length===3)return send(res,200,snapshot(run,role));
    if(req.method==='GET'&&parts[3]==='export'){if(!role.host)fail(403,'진행자 권한이 필요합니다.');return send(res,200,{code:run.code,title:run.title,blocks:run.blocks,responses:run.responses.map(({voters,...r})=>({...r,votes:voters.length})),ended:run.ended,expiresAt:run.expiresAt});}
    if(req.method!=='POST')fail(405,'지원하지 않는 요청입니다.');
    if(parts[3]==='reset'){store.runs=store.runs.filter(r=>r!==run);await save();return send(res,200,{reset:true});}
    if(parts[3]==='end'){run.ended=true;run.blocks.forEach(b=>b.open=false);}
    else if(parts[3]==='control'){
      if(run.ended)fail(409,'종료한 회차는 변경할 수 없습니다.');const b=run.blocks.find(b=>b.id===body.blockId);if(!b)fail(400,'활동을 찾을 수 없습니다.');if(typeof body.open==='boolean')b.open=body.open;if(typeof body.reveal==='boolean')b.reveal=body.reveal;run.active=b.id;
    } else if(parts[3]==='moderate'){
      const r=run.responses.find(r=>r.id===body.responseId);if(!r)fail(404,'응답을 찾을 수 없습니다.');if(typeof body.hidden==='boolean')r.hidden=body.hidden;if(body.status!==undefined){if(!['new','answered','parked'].includes(body.status))fail(400,'질문 상태가 올바르지 않습니다.');r.status=body.status;}
    } else if(parts[3]==='responses'){
      if(role.host)fail(403,'참가자로 입장해 주세요.');const b=run.blocks.find(b=>b.id===body.blockId);if(!b||b.id!==run.active||!b.open||run.ended)fail(409,'지금은 응답을 받지 않습니다.');
      if(run.responses.filter(r=>r.blockId===b.id&&r.participantId===role.id).length>=(b.type==='qa'?5:1))fail(409,'이미 응답했습니다.');
      let value=text(body.value,500);if(['poll','branch'].includes(b.type)&&!b.options.includes(value))fail(400,'선택지를 확인하세요.');
      if(b.type==='wordcloud'&&value.length>30)fail(400,'단어는 30자 이하입니다.');
      run.responses.push({id:crypto.randomUUID(),blockId:b.id,participantId:role.id,value,voters:[],hidden:false,status:'new',createdAt:Date.now()});
    } else if(parts[3]==='vote'){
      if(role.host||run.ended)fail(403,'공감할 수 없습니다.');const r=run.responses.find(r=>r.id===body.responseId),b=run.blocks.find(b=>b.id===r?.blockId);if(!r||r.hidden||b?.type!=='qa'||!b.reveal||!b.open||b.id!==run.active)fail(409,'지금은 공감할 수 없습니다.');if(!r.voters.includes(role.id))r.voters.push(role.id);
    } else fail(404,'지원하지 않는 경로입니다.');
    run.revision++;await save();return send(res,200,snapshot(run,role));
  }
  const server=http.createServer((req,res)=>{
    const job=async()=>{const before=req.method==='POST'?structuredClone(store):null;try{const url=new URL(req.url,'http://local');if(url.pathname.startsWith('/api/'))return await api(req,res,url);
      if(req.method!=='GET')return send(res,405,{error:'GET만 가능합니다.'});
      const pathname=decodeURIComponent(url.pathname),relative=pathname.endsWith('/')?pathname+'index.html':pathname;
      const resolved=path.resolve(publicDir,'.'+relative);if(!resolved.startsWith(path.resolve(publicDir)+path.sep)||relative.split('/').some(p=>p.startsWith('.')))return send(res,404,{error:'없음'});
      const actual=await fs.realpath(resolved);if(!actual.startsWith(await fs.realpath(publicDir)+path.sep))return send(res,404,{error:'없음'});
      const data=await fs.readFile(actual),mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(actual)]||'application/octet-stream';res.writeHead(200,{'content-type':mime,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'});res.end(data);
    }catch(e){if(before)store=before;send(res,e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:'요청을 처리할 수 없습니다.'});}};
    serial=serial.then(job,job);
  });
  await new Promise(resolve=>server.listen(port,host,resolve));
  return {server,url:`http://${host}:${server.address().port}`,operatorKey,dataDir};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const instance=await startLive({port:Number(process.env.PORT)||8792});
  console.log(`로컬 참여 서버: ${instance.url}\n진행자: ${instance.url}/live-host/\n서버 운영 키(채팅/저장소에 올리지 마세요): ${instance.operatorKey}\n회차 데이터: ${instance.dataDir}\n외부 공개는 HTTPS·역방향 프록시·백업·접근 제어를 별도로 구성하세요.`);
}
