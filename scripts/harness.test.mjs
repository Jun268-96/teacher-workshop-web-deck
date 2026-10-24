import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkProject,doctor,setup,fingerprint,serve,writeJson,loadPlaywright} from '../assets/starter-deck/harness/lib.mjs';
import {verifyBrowser} from '../assets/starter-deck/harness/verify-browser.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const starter=path.join(skill,'assets/starter-deck');
async function fixture(t) {
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'workshop-skill-test-'));
  t.after(()=>fs.rm(parent,{recursive:true,force:true}));
  const root=path.join(parent,'deck'); await fs.cp(starter,root,{recursive:true}); return root;
}
function cli(root,args) { return spawnSync(process.execPath,[path.join(root,'harness/harness.mjs'),...args],{encoding:'utf8',cwd:root,timeout:15000}); }
async function gateEvidence(root) {
  // Deliberate synthetic records test the gate in isolation, not browser quality.
  const hash=await fingerprint(root);
  await writeJson(path.join(root,'qa/results/local-latest.json'),{id:'gate-fixture',passed:true,fingerprint:hash});
  await writeJson(path.join(root,'qa/visual-review.json'),{status:'passed',reportId:'gate-fixture',fingerprint:hash,note:'Synthetic unit-test fixture'});
}
test('scaffolding preserves original and rejects an existing destination',async t=>{
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'workshop-scaffold-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));
  const dest=path.join(parent,'new');
  const first=spawnSync(process.execPath,[path.join(skill,'scripts/create-deck.mjs'),'--dest',dest,'--name','isolated-workshop-test'],{encoding:'utf8'});
  assert.equal(first.status,0);await fs.writeFile(path.join(dest,'keep.txt'),'user work');
  const second=spawnSync(process.execPath,[path.join(skill,'scripts/create-deck.mjs'),'--dest',dest],{encoding:'utf8'});
  assert.notEqual(second.status,0);assert.equal(await fs.readFile(path.join(dest,'keep.txt'),'utf8'),'user work');
  assert.equal(JSON.parse(await fs.readFile(path.join(dest,'wrangler.json'))).assets.directory,'./public');
  assert.ok(await fs.stat(path.join(dest,'public/assets/fonts/Pretendard-LICENSE.txt')));
  const ids=[];for(const folder of ['another','third']){const next=path.join(parent,folder),made=spawnSync(process.execPath,[path.join(skill,'scripts/create-deck.mjs'),'--dest',next],{encoding:'utf8'});assert.equal(made.status,0,made.stderr);ids.push((await fs.readFile(path.join(next,'public/config.js'),'utf8')).match(/deckId: "([^"]+)"/)[1]);}assert.notEqual(ids[0],ids[1]);
});
test('doctor is read-only and missing dependencies do not install themselves',async t=>{
  const root=await fixture(t),before=await fingerprint(root);
  const saved={p:process.env.WORKSHOP_PLAYWRIGHT_MODULE,w:process.env.WORKSHOP_WRANGLER_CLI};
  process.env.WORKSHOP_PLAYWRIGHT_MODULE=path.join(root,'nonexistent-playwright.mjs');process.env.WORKSHOP_WRANGLER_CLI=path.join(root,'nonexistent-wrangler.js');
  try { const state=await doctor(root); assert.equal(state.mutates,false);assert.equal(state.tools.playwright,false);assert.equal(state.tools.wrangler,false);assert.equal(state.tools.chromium,false); }
  finally { for(const [key,value] of Object.entries({WORKSHOP_PLAYWRIGHT_MODULE:saved.p,WORKSHOP_WRANGLER_CLI:saved.w})) { if(value===undefined) delete process.env[key];else process.env[key]=value; } }
  assert.equal(await fingerprint(root),before);
});
test('installation is blocked without the matching user consent',async t=>{
  const root=await fixture(t),before=await fingerprint(root);
  await assert.rejects(()=>setup(root,'browser',undefined),/not authorized/);
  await assert.rejects(()=>setup(root,'deploy','install-browser'),/not authorized/);
  assert.equal(await fingerprint(root),before);
  await assert.rejects(fs.access(path.join(root,'node_modules')));
});
test('valid static template passes without external dependencies',async t=>{
  const root=await fixture(t),result=await checkProject(root); assert.equal(result.passed,true,JSON.stringify(result.errors));
});
test('missing assets fail instead of silently publishing broken thumbnails',async t=>{
  const root=await fixture(t);await fs.unlink(path.join(root,'public/assets/brand/bandi.png'));
  const result=await checkProject(root);assert.equal(result.passed,false);assert.ok(result.errors.some(e=>e.includes('Missing local resource')));
});
test('private planning files and unsafe URLs are rejected',async t=>{
  const root=await fixture(t);await fs.mkdir(path.join(root,'public/workshop'));await fs.writeFile(path.join(root,'public/workshop/private.txt'),'private notes');
  await fs.appendFile(path.join(root,'public/index.html'),'<a href="javascript:alert(1)">bad</a>');
  const result=await checkProject(root);assert.equal(result.passed,false);assert.ok(result.errors.some(e=>e.includes('Private file')));assert.ok(result.errors.some(e=>e.includes('protocol')));
});
test('local preview only serves public assets, not notes or harness',async t=>{
  const root=await fixture(t),preview=await serve(root);t.after(()=>new Promise(resolve=>preview.server.close(resolve)));
  assert.equal((await fetch(preview.url)).status,200);
  assert.equal((await fetch(new URL('workshop/brief.md',preview.url))).status,404);
  assert.equal((await fetch(new URL('harness/harness.mjs',preview.url))).status,404);
  assert.equal((await fetch(new URL('assets/brand/didi.png',preview.url))).status,200);
});
test('deploy is blocked before browser verification',async t=>{
  const root=await fixture(t);const result=cli(root,['deploy','--execute']);assert.notEqual(result.status,0);assert.match(result.stderr,/verification has not run/);
});
test('passing automatic checks alone cannot bypass visual review',async t=>{
  const root=await fixture(t);await writeJson(path.join(root,'qa/results/local-latest.json'),{passed:true,fingerprint:await fingerprint(root)});
  const result=cli(root,['deploy','--execute']);assert.notEqual(result.status,0);assert.match(result.stderr,/visual review/);
});
test('changing the deck invalidates old browser and visual evidence',async t=>{
  const root=await fixture(t);await gateEvidence(root);await fs.appendFile(path.join(root,'public/style.css'),'\nbody{color:#123;}');
  const result=cli(root,['deploy','--execute']);assert.notEqual(result.status,0);assert.match(result.stderr,/stale/);
});
test('backend target cannot be pushed through the static deploy adapter',async t=>{
  const root=await fixture(t);await writeJson(path.join(root,'wrangler.json'),{name:'test-only',assets:{directory:'./public'},main:'worker.js'});await gateEvidence(root);
  const result=cli(root,['deploy','--execute']);assert.notEqual(result.status,0);assert.match(result.stderr,/backend-specific/);
});
let browserAvailable=false;
try { await loadPlaywright(starter);browserAvailable=true; } catch {}
test('real browser catches a deliberately broken layout', {skip:!browserAvailable},async t=>{
  const root=await fixture(t);await fs.appendFile(path.join(root,'public/style.css'),'\n.slide.active h2{position:relative;left:-300px}');
  const preview=await serve(root);t.after(()=>new Promise(resolve=>preview.server.close(resolve)));
  const report=await verifyBrowser(root,preview.url);assert.equal(report.passed,false);assert.ok(report.errors.some(e=>e.includes('clipping')));
});
test('flow adapter observes real server state across three isolated clients and reload', {skip:!browserAvailable},async t=>{
  const root=await fixture(t);
  const html=path.join(root,'public/index.html');await fs.writeFile(html,(await fs.readFile(html,'utf8')).replace('</head>','<script src="sync-fixture.js" defer></script></head>'));
  await fs.writeFile(path.join(root,'public/sync-fixture.js'),`const note=document.querySelector('#request-note');note.addEventListener('input',()=>fetch('/api/fixture-note',{method:'POST',body:note.value}));async function sync(){try{const value=await(await fetch('/api/fixture-note')).text();if(document.activeElement!==note)note.value=value;}finally{setTimeout(sync,150);}}sync();`);
  const preview=await serve(root);t.after(()=>new Promise(resolve=>preview.server.close(resolve)));
  let value='';const server=http.createServer(async(req,res)=>{
    if(req.url==='/api/fixture-note') { if(req.method==='POST') { let body='';for await(const chunk of req) body+=chunk;value=body; }res.end(value);return; }
    const response=await fetch(new URL(req.url,preview.url));res.writeHead(response.status,{'content-type':response.headers.get('content-type')||'text/plain'});res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  await writeJson(path.join(root,'qa/flows.json'),{flows:[{name:'server fixture sharing and reload',sessions:{presenter:'/#demo',one:'/#demo',two:'/#demo'},steps:[
    ...['presenter','one','two'].map(session=>({session,action:'click',selector:'[data-tab=plan]'})),
    {session:'one',action:'fill',selector:'#request-note',value:'isolated fixture record'},
    {session:'presenter',action:'expectValue',selector:'#request-note',value:'isolated fixture record'},
    {session:'two',action:'expectValue',selector:'#request-note',value:'isolated fixture record'},
    {session:'two',action:'reload'},
    {session:'two',action:'click',selector:'[data-tab=plan]'},
    {session:'two',action:'expectValue',selector:'#request-note',value:'isolated fixture record'}
  ]}]});
  const report=await verifyBrowser(root,`http://127.0.0.1:${server.address().port}/`);assert.equal(report.passed,true,JSON.stringify(report.errors));assert.ok(report.checks.some(x=>x.includes('3 isolated sessions')));
});
test('characters are absent by default and work only when explicitly enabled', {skip:!browserAvailable},async t=>{
  const root=await fixture(t),preview=await serve(root);t.after(()=>new Promise(resolve=>preview.server.close(resolve)));
  const {chromium}=await loadPlaywright(root),browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});await page.goto(preview.url);
  assert.equal(await page.locator('.mascots').isVisible(),false);
  await page.goto(new URL('#closing',preview.url).href);assert.equal(await page.locator('.closing-art').isVisible(),false);
  const config=path.join(root,'public/config.js');await fs.writeFile(config,(await fs.readFile(config,'utf8')).replace('mascots: false','mascots: true'));
  await page.goto(preview.url);await page.reload();assert.equal(await page.locator('.mascots').isVisible(),true);
  await page.locator('.mascot.didi').hover();assert.equal(await page.locator('.mascot.didi>span').evaluate(el=>getComputedStyle(el).animationName),'shiver');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.mascot.didi>span').evaluate(el=>getComputedStyle(el).animationName),'none');
});
test('downloaded public HTML can navigate without a server', {skip:!browserAvailable},async t=>{
  const root=await fixture(t),{chromium}=await loadPlaywright(root),browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(new URL(`file://${path.join(root,'public/index.html')}`).href);
  assert.equal(await page.locator('.slide.active').getAttribute('id'),'start');
  await page.locator('[data-next]').click();assert.equal(await page.locator('.slide.active').getAttribute('id'),'chapter');
  await page.goto(new URL(`file://${path.join(root,'public/index.html')}#demo`).href);await page.locator('#student-count').fill('1');await page.locator('#draw').click();assert.equal(await page.locator('#draw-result').textContent(),'1번');
});
test('public verification tolerates brief readiness delay without redeploying', {skip:!browserAvailable},async t=>{
  const root=await fixture(t),preview=await serve(root);t.after(()=>new Promise(resolve=>preview.server.close(resolve)));
  const hash=await fingerprint(root);let probes=0;
  const server=http.createServer(async(req,res)=>{
    if(req.url.startsWith('/build.json')) { probes++;if(probes===1){res.writeHead(503);res.end('not ready');}else{res.setHeader('content-type','application/json');res.end(JSON.stringify({fingerprint:hash}));}return; }
    const response=await fetch(new URL(req.url,preview.url));res.writeHead(response.status,{'content-type':response.headers.get('content-type')||'text/plain'});res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const report=await verifyBrowser(root,`http://127.0.0.1:${server.address().port}/`,{publicRun:true,expectedBuild:hash});
  assert.equal(report.passed,true,JSON.stringify(report.errors));assert.equal(probes,2);assert.ok(report.checks.includes('public-build-marker'));
});
test('public-only recheck updates only the matching deployment evidence',async t=>{
  const root=await fixture(t);
  const {updateDeploymentEvidence}=await import('../assets/starter-deck/harness/lib.mjs');
  const hash=await fingerprint(root),file=path.join(root,'qa/results/deployment.json');
  await writeJson(file,{url:'https://example.workers.dev',fingerprint:hash,status:'public-verification-failed',publicReport:'old'});
  assert.equal(await updateDeploymentEvidence(root,{kind:'public',url:'https://other.workers.dev',fingerprint:hash,passed:true,id:'wrong'}),false);
  assert.equal(JSON.parse(await fs.readFile(file)).publicReport,'old');
  assert.equal(await updateDeploymentEvidence(root,{kind:'public',url:'https://example.workers.dev/',fingerprint:hash,passed:true,id:'new'}),true);
  const updated=JSON.parse(await fs.readFile(file));assert.equal(updated.publicReport,'new');assert.equal(updated.status,'public-browser-verified');
});
