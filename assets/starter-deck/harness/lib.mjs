import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const versions = { playwright: '1.62.1', wrangler: '4.127.1' };
export async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
export async function filesUnder(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }); const result = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not publishable: ${file}`);
    if (entry.isDirectory()) result.push(...await filesUnder(file)); else result.push(file);
  }
  return result.sort();
}
export async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function writeJson(file, data) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n'); }
export async function fingerprint(root) {
  const files = [...await filesUnder(path.join(root, 'public')), ...await filesUnder(path.join(root, 'harness'))];
  for (const name of ['qa/flows.json','package.json','wrangler.json']) if (await exists(path.join(root,name))) files.push(path.join(root,name));
  const hash = crypto.createHash('sha256');
  for (const file of files.sort()) {
    if (file === path.join(root,'public/build.json')) continue;
    hash.update(path.relative(root,file).replaceAll(path.sep,'/')); hash.update('\0'); hash.update(await fs.readFile(file)); hash.update('\0');
  }
  return hash.digest('hex');
}
export function resolveTool(root, tool) {
  const supplied = tool === 'playwright' ? process.env.WORKSHOP_PLAYWRIGHT_MODULE : process.env.WORKSHOP_WRANGLER_CLI;
  if (supplied) return existsSync(path.resolve(supplied)) ? path.resolve(supplied) : null;
  const require = createRequire(path.join(root, 'package.json'));
  try { return tool === 'playwright' ? require.resolve('playwright') : path.join(path.dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js'); }
  catch { return null; }
}
export async function loadPlaywright(root) {
  const module = resolveTool(root,'playwright');
  if (!module) throw new Error('Playwright is missing. Run doctor and ask the user before installation.');
  const loaded = await import(pathToFileURL(module).href); return loaded.chromium ? loaded : loaded.default;
}
export function readConfig(source) {
  const context = { window: {} }; vm.runInNewContext(source, context, { timeout: 1000 });
  return JSON.parse(JSON.stringify(context.window.WORKSHOP_CONFIG || {}));
}
function localPath(reference, base, publicDir) {
  if (!reference || reference.startsWith('#') || /^(https?:|data:)/i.test(reference)) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(reference)) throw new Error('Unsupported resource protocol');
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  const resolved = clean.startsWith('/') ? path.resolve(publicDir, '.' + clean) : path.resolve(path.dirname(base),clean);
  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) throw new Error('Resource escapes public directory');
  return resolved;
}
export async function checkProject(root) {
  const publicDir = path.join(root,'public'), errors = [], warnings = [];
  if (!await exists(path.join(publicDir,'index.html'))) throw new Error('public/index.html is required');
  const files = await filesUnder(publicDir);
  for (const file of files) {
    const name = path.relative(publicDir,file);
    if (/(^|\/)(\.env(?:\.|$)|\.git|node_modules|\.wrangler|workshop|harness|qa)(\/|$)/.test(name) || /\.(?:pem|key)$/.test(name)) errors.push(`Private file in public/: ${name}`);
    if (!/\.(html|css|js|json|svg|txt)$/.test(file)) continue;
    const source = await fs.readFile(file,'utf8');
    if (/(?:sk-or-v1-[\da-z]{20,}|sk-[\da-zA-Z_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(source)) errors.push(`Possible credential in ${name}; value omitted`);
    let references = [];
    if (file.endsWith('.html')) {
      const ids = [...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m=>m[1]);
      if (new Set(ids).size !== ids.length) errors.push(`Duplicate HTML ids: ${name}`);
      references = [...source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(m=>m[1]);
    }
    if (file.endsWith('.css')) references = [...source.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1]);
    if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
      if (result.status !== 0) errors.push(`JavaScript syntax error: ${name}`);
    }
    if (name === 'config.js') {
      try {
        const config = readConfig(source);
        if (!config.title || !config.deckId) errors.push('config.js requires title and deckId');
        if (config.logo) references.push(config.logo);
        for (const resource of config.resources || []) { if (resource.image) references.push(resource.image); if (resource.href) references.push(resource.href); }
      } catch { errors.push('config.js must be a data-only WORKSHOP_CONFIG assignment'); }
    }
    for (const reference of references) {
      try {
        const resolved = localPath(reference,file,publicDir);
        if (resolved && !await exists(resolved)) errors.push(`Missing local resource in ${name}: ${reference}`);
        if (/^https?:/i.test(reference) && new URL(reference).username) errors.push(`Credential-bearing URL in ${name}`);
      } catch (e) { errors.push(`${e.message} in ${name}`); }
    }
  }
  const html = await fs.readFile(path.join(publicDir,'index.html'),'utf8');
  if (/입력하세요|CASE SLOT|TEACHER WORKSHOP/.test(html)) warnings.push('Visible starter instructions may remain; inspect the slide copy.');
  return { passed: errors.length === 0, errors, warnings, fingerprint: await fingerprint(root), files: files.length };
}
export async function serve(root, port = 0) {
  const publicDir = await fs.realpath(path.join(root,'public'));
  const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8' };
  const server = http.createServer(async (req,res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      let file = path.resolve(publicDir,'.'+pathname);
      if (file !== publicDir && !file.startsWith(publicDir+path.sep)) throw new Error('outside');
      if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html');
      const real = await fs.realpath(file);
      if (!real.startsWith(publicDir+path.sep)) throw new Error('outside');
      const body = await fs.readFile(real); res.writeHead(200,{'content-type':types[path.extname(real)]||'application/octet-stream','cache-control':'no-store'}); res.end(body);
    } catch { res.writeHead(404,{'content-type':'text/plain'}); res.end('Not found'); }
  });
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(port,'127.0.0.1',resolve); });
  return { server, url:`http://127.0.0.1:${server.address().port}/` };
}
export function runTool(cli,args,root) {
  if (!cli) throw new Error('Wrangler is missing. Run doctor and ask the user before installation.');
  const result = spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',timeout:180000,env:{...process.env,CI:'1',NO_COLOR:'1'}});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler failed (${result.status}): ${(result.stderr || result.stdout).replace(/sk-[\w-]+/g,'[redacted]').slice(-1800)}`);
  return result.stdout;
}
export async function doctor(root) {
  const module = resolveTool(root,'playwright'), cli = resolveTool(root,'wrangler'); let browser = false;
  try { const {chromium} = await loadPlaywright(root); browser = await exists(chromium.executablePath()); } catch {}
  const npm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',['--version'],{encoding:'utf8'});
  return {
    node: process.versions.node, supportedNode:Number(process.versions.node.split('.')[0]) >= 22, npm:npm.status === 0,
    tools:{ playwright:!!module, chromium:browser, wrangler:!!cli },
    installNeeded:[...(!module || !browser ? ['browser'] : []),...(!cli ? ['deploy'] : [])],
    account:'Not checked. Deployment authentication is separate from installation.',
    mutates:false,
    prompts:{browser:'화면 잘림과 버튼 동작을 자동으로 검사하려면 Playwright와 Chromium이 필요해요. 설치할까요? 설치하지 않으면 브라우저 자동 검증은 생략됩니다.',deploy:'공유 주소를 만들려면 Wrangler가 필요해요. 설치할까요? Cloudflare 가입·로그인은 별도이며, 파일로만 받을 수도 있어요.'}
  };
}
export async function setup(root,tool,consent) {
  if (!['browser','deploy'].includes(tool)) throw new Error('Choose --tool browser or --tool deploy');
  if (consent !== `install-${tool}`) throw new Error(`Installation not authorized. Ask the user first; then pass --consent install-${tool}.`);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const pkg = tool === 'browser' ? 'playwright' : 'wrangler';
  if (!resolveTool(root,pkg)) {
    const result = spawnSync(npm,['install','--save-dev','--ignore-scripts',`${pkg}@${versions[pkg]}`],{cwd:root,stdio:'inherit',timeout:180000});
    if (result.status !== 0) throw new Error('Installation failed; do not claim verification or deployment.');
  }
  if (tool === 'browser') {
    const module = resolveTool(root,'playwright');
    const cli = path.join(path.dirname(module),'cli.js');
    const result = spawnSync(process.execPath,[cli,'install','chromium'],{cwd:root,stdio:'inherit',timeout:180000});
    if (result.status !== 0) throw new Error('Chromium installation failed.');
  }
  return doctor(root);
}
export async function temporaryDirectory(prefix) { return fs.mkdtemp(path.join(os.tmpdir(),prefix)); }

export async function updateDeploymentEvidence(root,report) {
  const file=path.join(root,'qa/results/deployment.json');
  if(report.kind!=='public' || !await exists(file)) return false;
  const deployment=await readJson(file);
  if(deployment.fingerprint!==report.fingerprint || new URL(deployment.url).href!==new URL(report.url).href) return false;
  deployment.publicReport=report.id;
  deployment.status=report.passed?'public-browser-verified':'public-verification-failed';
  await writeJson(file,deployment);return true;
}
