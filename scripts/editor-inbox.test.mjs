import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import http from 'node:http';
import {openInbox} from '../assets/starter-deck/server/editor-inbox.mjs';
import {serve,loadPlaywright,resolveTool} from '../assets/starter-deck/harness/lib.mjs';
import {panel,selectObject,selectPage,action,editText} from './editor-test-helpers.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),starter=path.join(repo,'assets/starter-deck');
const ui=(name,fn)=>test(name,{skip:!resolveTool(starter,'playwright')&&'Playwright unavailable'},fn);
async function shot(p,name){if(process.env.WORKSHOP_INBOX_OUTPUT){await fs.mkdir(process.env.WORKSHOP_INBOX_OUTPUT,{recursive:true});await p.screenshot({path:path.join(process.env.WORKSHOP_INBOX_OUTPUT,name+'.png')});}}
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'workshop-inbox-'));await fs.cp(starter,root,{recursive:true});t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
async function server(t,root){const s=await serve(root,0,{editorInbox:true});t.after(()=>new Promise(r=>{s.server.close(r);s.server.closeAllConnections?.();}));return s;}
function seed(){const document={schema:1,templateVersion:1,deckId:'workshop-template',revision:3,pages:[{id:'start',template:'start',title:'시작',notes:'비공개 발표 메모',seconds:0,objects:[{id:'start-title',key:'title',type:'text',content:'현재 편집한 제목',deleted:false,style:{offsetX:5,fontSize:58},behavior:{tooltip:'보존할 설명'}}]}]};return{format:'workshop-editor-inbox/v1',document,requests:[{id:'request-one',request:'제목을 짧게',trigger:'',context:{deckId:document.deckId,revision:3,page:{id:'start',title:'시작'},object:document.pages[0].objects[0]}}]};}
const command=(root,args)=>spawnSync(process.execPath,[path.join(root,'server/editor-inbox.mjs'),...args],{encoding:'utf8',cwd:root});
const patch=batch=>({deckId:batch.deckId,baseRevision:batch.baseRevision,changes:[{pageId:'start',objectId:'start-title',set:{content:'요청함에서 수정한 제목'}}]});

test('disk inbox is private, immutable and idempotent; separate agent CLI reads, claims and returns a validated patch',async t=>{
 const root=await fixture(t),store=await openInbox(root);assert.deepEqual(await store.list(),[]);await assert.rejects(fs.access(path.join(root,'.workshop-editor')));
 const input=seed(),saved=await store.save(input),dir=path.join(root,'.workshop-editor/inbox',saved.id),before=await fs.readFile(path.join(dir,'request.json'),'utf8');
 assert.deepEqual(saved.batch.document,input.document);assert.equal((await fs.stat(path.join(dir,'request.json'))).mode&0o777,0o600);
 assert.equal(command(root,['list']).status,0);const read=command(root,['read',saved.id,'--full']);assert.equal(read.status,0,read.stderr);assert.deepEqual(JSON.parse(read.stdout).batch.document,input.document);
 assert.equal(command(root,['status',saved.id,'--state','working','--expect','pending']).status,0);assert.equal(command(root,['status',saved.id,'--state','working','--expect','pending']).status,1);
 const retry=await store.save(input);assert.equal(retry.id,saved.id);assert.equal(retry.duplicate,true);assert.equal(retry.status.state,'working');assert.equal((await fs.readdir(path.dirname(dir))).length,1);
 const file=path.join(root,'result.json');await fs.writeFile(file,JSON.stringify(patch(saved.batch)));const result=command(root,['result',saved.id,'--patch',file]);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).state,'ready');
 assert.equal((await store.view(saved.id)).patch.changes[0].set.content,'요청함에서 수정한 제목');await assert.rejects(store.applied(saved.id,999));assert.equal((await store.applied(saved.id,4)).state,'done');assert.equal((await store.applied(saved.id,4)).state,'done');
 assert.deepEqual(await store.list(),[]);assert.equal((await store.list(true)).length,1);assert.equal(await fs.readFile(path.join(dir,'request.json'),'utf8'),before);assert.equal((await store.save(input)).status.state,'done');
 const changed=structuredClone(input);changed.document.revision++;changed.document.pages[0].objects[0].content='다시 수정한 편집본';assert.notEqual((await store.save(changed)).id,saved.id);
 const restarted=await openInbox(root);assert.equal((await restarted.list()).length,1);
});
test('inbox rejects wrong deck, unsafe patches and symlinks; CLI list is read-only and write locks do not lose requests',async t=>{
 const root=await fixture(t),store=await openInbox(root);const wrong=seed();wrong.document.deckId='other';await assert.rejects(store.save(wrong));
 const saved=await store.save(seed()),dir=path.join(root,'.workshop-editor/inbox',saved.id),bad=patch(saved.batch);bad.changes[0].set={content:'javascript:ignored',onclick:'alert(1)'};await assert.rejects(store.result(saved.id,bad));assert.equal((await store.read(saved.id)).status.state,'pending');
 const invalid=patch(saved.batch);invalid.changes[0].set={style:{fontSize:10000}};await assert.rejects(store.result(saved.id,invalid));
 await fs.writeFile(path.join(dir,'.lock'),'another agent');await assert.rejects(store.status(saved.id,'working'),/갱신 중/);assert.equal((await store.read(saved.id)).batch.requests.length,1);await fs.unlink(path.join(dir,'.lock'));
 await assert.rejects(store.read('../../outside'));const empty=await fixture(t),outside=await fs.mkdtemp(path.join(os.tmpdir(),'workshop-inbox-outside-'));t.after(()=>fs.rm(outside,{recursive:true,force:true}));await fs.symlink(outside,path.join(empty,'.workshop-editor'));await assert.rejects((await openInbox(empty)).save(seed()),/일반 폴더/);assert.deepEqual(await fs.readdir(outside),[]);
});
test('local inbox HTTP requires correct Host, Origin and server token and never serves private snapshots statically',async t=>{
 const root=await fixture(t),s=await server(t,root),base=s.url.slice(0,-1),cap=await fetch(base+'/api/editor-inbox').then(r=>r.json());assert.equal(cap.available,true);
 const post=(body,headers={})=>fetch(base+'/api/editor-inbox/batches',{method:'POST',headers:{'content-type':'application/json','x-workshop-editor-token':cap.token,...headers},body:JSON.stringify(body)});
 assert.equal((await post(seed(),{'x-workshop-editor-token':'wrong'})).status,403);assert.equal((await post(seed(),{origin:'https://other.example'})).status,403);const wrongHost=await new Promise((resolve,reject)=>{http.get(base+'/api/editor-inbox',{headers:{host:'other.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(wrongHost,403);
 const result=await post(seed());assert.equal(result.status,201);const saved=await result.json();assert.equal((await post(seed())).status,200);
 assert.equal((await fetch(base+'/'+saved.location)).status,404);assert.equal((await fetch(base+'/api/editor-inbox/batches/'+saved.id)).status,403);assert.equal((await fetch(base+'/api/editor-inbox/batches/'+saved.id,{headers:{'x-workshop-editor-token':cap.token}})).status,200);
 const zip=path.join(root,'source.zip'),pack=spawnSync(process.execPath,[path.join(repo,'scripts/package-deck.mjs'),'--project',root,'--dest',zip],{encoding:'utf8'});assert.equal(pack.status,0,pack.stderr);const names=spawnSync('unzip',['-Z1',zip],{encoding:'utf8'}).stdout;assert.ok(!names.includes('.workshop-editor/'));assert.ok(names.includes('server/editor-inbox.mjs'));assert.ok(names.includes('CLAUDE.md'));assert.ok(names.includes('workshop/editor-inbox.md'));
});
async function edit(t){const root=await fixture(t),s=await server(t,root),{chromium}=await loadPlaywright(root),browser=await chromium.launch({headless:true});t.after(()=>browser.close());const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));await p.goto(s.url+'?edit=1');await p.locator('#edit-toggle').click();return {root,p,browser,s};}
async function request(p,id,text){await selectObject(p,id);await panel(p,'request');await p.locator('#change-request').fill(text);await action(p,'queue-add');}
async function submit(p){await panel(p,'queue');await p.locator('#queue-inbox-button').click();await p.waitForFunction(()=>document.querySelector('#queue-inbox-help').textContent.startsWith('프로젝트 요청함에 저장됨'));}

ui('no annotation API or clipboard: real browser save -> disk -> agent CLI -> preview/cancel/accept -> status and undo',async t=>{
 const {root,p}=await edit(t);assert.equal(await p.evaluate(()=>typeof document.oai?.annotation?.request),'undefined');await selectObject(p,'start-title');await editText(p,'브라우저에서 이미 고친 제목');
 const buffer=await p.screenshot({clip:{x:0,y:0,width:120,height:80}}),chooser=p.waitForEvent('filechooser');await action(p,'add-image');await(await chooser).setFiles({name:'local.png',mimeType:'image/png',buffer});await p.locator('#deck img[data-added]').waitFor();
 await request(p,'start-title','제목만 간단하게 바꿔줘');await selectPage(p,'demo');await request(p,'demo-heading','크기만 키워줘');const doc=await p.evaluate(()=>WorkshopEditor.document),requests=await p.evaluate(()=>WorkshopEditor.requests);await submit(p);await shot(p,'01-project-inbox');
 const store=await openInbox(root),listed=command(root,['list']);assert.equal(listed.status,0,listed.stderr);const list=JSON.parse(listed.stdout);assert.equal(list.length,1);const id=list[0].id,{batch}=await store.read(id);assert.deepEqual(batch.document,doc);assert.deepEqual(batch.requests,requests);assert.ok(batch.document.pages[0].objects.some(o=>o.type==='image'&&o.content.startsWith('data:image/')));
 await p.locator('#queue-inbox-button').click();assert.equal((await store.list()).length,1);const file=path.join(root,'agent-result.json');await fs.writeFile(file,JSON.stringify(patch(batch)));const result=command(root,['result',id,'--patch',file]);assert.equal(result.status,0,result.stderr);
 await p.locator('#inbox-result-button').click();await p.locator('#patch-dialog').waitFor();await shot(p,'02-fileless-preview');assert.equal(await p.locator('#cover-title').isVisible(),true);assert.equal(await p.locator('#cover-title').textContent(),'요청함에서 수정한 제목');assert.deepEqual(await p.evaluate(()=>WorkshopEditor.document),doc);await action(p,'patch-cancel');assert.equal(await p.locator('#cover-title').textContent(),'브라우저에서 이미 고친 제목');assert.equal((await store.read(id)).status.state,'ready');
 await panel(p,'queue');await p.locator('#inbox-result-button').click();await p.locator('#patch-dialog').waitFor();await action(p,'patch-accept');await p.waitForFunction(()=>document.querySelector('#queue-inbox-help').textContent.includes('변경안을 반영했습니다'));assert.equal((await store.read(id)).status.state,'done');const accepted=await p.evaluate(()=>WorkshopEditor.document);assert.equal(accepted.pages[0].objects.find(o=>o.id==='start-title').content,'요청함에서 수정한 제목');assert.deepEqual(accepted.pages[0].objects.find(o=>o.type==='image'),doc.pages[0].objects.find(o=>o.type==='image'));assert.deepEqual(await p.evaluate(()=>WorkshopEditor.requests),requests);
 await action(p,'undo');assert.deepEqual((await p.evaluate(()=>WorkshopEditor.document)).pages,doc.pages);await p.reload();await p.locator('#edit-toggle').click();await panel(p,'queue');await p.locator('#inbox-result-button').click();await p.waitForFunction(()=>document.querySelector('#queue-inbox-help').textContent.includes('이미 처리'));
});
ui('later edits reject stale inbox results and failed saves preserve the queue; action controls fit mobile',async t=>{
 const {root,p}=await edit(t);await request(p,'start-title','제목 수정');await submit(p);const store=await openInbox(root),[entry]=await store.list(),{batch}=await store.read(entry.id);await store.result(entry.id,patch(batch));await p.locator('[data-ui-action=close]').click();await p.locator('#cover-title').click();await p.locator('[data-ui-action=font-plus]').click();const edited=await p.evaluate(()=>WorkshopEditor.document);await panel(p,'queue');await p.locator('#inbox-result-button').click();await p.waitForFunction(()=>document.querySelector('#queue-inbox-help').textContent.includes('버전'));assert.deepEqual(await p.evaluate(()=>WorkshopEditor.document),edited);assert.equal(await p.locator('#patch-dialog').isVisible(),false);
 await p.route('**/api/editor-inbox/batches',r=>r.abort());await p.locator('#queue-inbox-button').click();await p.waitForFunction(()=>document.querySelector('#queue-inbox-help').textContent.startsWith('저장하지 못했습니다'));assert.equal((await p.evaluate(()=>WorkshopEditor.requests)).length,1);assert.deepEqual(await p.evaluate(()=>WorkshopEditor.document),edited);assert.equal((await store.list()).length,1);await p.unroute('**/api/editor-inbox/batches');
 for(const [width,height]of [[390,844],[844,390],[1024,768]]){await p.setViewportSize({width,height});await panel(p,'queue');for(const selector of ['#queue-inbox-button','#inbox-result-button']){await p.locator(selector).scrollIntoViewIfNeeded();const b=await p.locator(selector).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=height+1);}await shot(p,'inbox-'+width+'x'+height);}
});
