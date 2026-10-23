#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProject, doctor, setup, serve, fingerprint, readJson, writeJson, exists, resolveTool, runTool, updateDeploymentEvidence } from './lib.mjs';
import { verifyBrowser } from './verify-browser.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2), command=args.shift()||'doctor';
const value=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
const print=data=>console.log(JSON.stringify(data,null,2));
export async function gate(projectRoot) {
  const check=await checkProject(projectRoot); if(!check.passed) throw new Error(`Static check failed: ${check.errors.join('; ')}`);
  const reportFile=path.join(projectRoot,'qa/results/local-latest.json');
  if(!await exists(reportFile)) throw new Error('Local browser verification has not run.');
  const report=await readJson(reportFile);
  if(!report.passed || report.fingerprint!==check.fingerprint) throw new Error('Local browser verification failed or is stale. Run verify again.');
  const reviewFile=path.join(projectRoot,'qa/visual-review.json');
  if(!await exists(reviewFile)) throw new Error('Screenshots need a visual review before deployment.');
  const review=await readJson(reviewFile);
  if(review.status!=='passed' || review.fingerprint!==check.fingerprint || review.reportId!==report.id || !review.note?.trim()) throw new Error('Visual review is missing, failed, or stale. Inspect current screenshots.');
  return check;
}
async function main() {
  if(command==='doctor') return print(await doctor(root));
  if(command==='setup') return print(await setup(root,value('--tool'),value('--consent')));
  if(command==='check') { const result=await checkProject(root); print(result); if(!result.passed) process.exitCode=1; return; }
  if(command==='serve') { const served=await serve(root,Number(value('--port'))||8791); console.log(served.url); return; }
  if(command==='verify') {
    const check=await checkProject(root); if(!check.passed) throw new Error(check.errors.join('; '));
    const target=value('--url');
    if(target && !['https:','http:'].includes(new URL(target).protocol)) throw new Error('Expected HTTP(S) URL');
    let served;
    try {
      if(!target) served=await serve(root);
      const report=await verifyBrowser(root,target||served.url,{publicRun:!!target,expectedBuild:value('--build')});
      if(target && value('--build')===report.fingerprint) await updateDeploymentEvidence(root,report);
      print({passed:report.passed,kind:report.kind,checks:report.checks,errors:report.errors,warnings:report.warnings,screenshots:report.screenshots.length,report:`qa/results/${report.kind}-latest.json`});
      if(!report.passed) process.exitCode=1;
    } finally { if(served) await new Promise(resolve=>served.server.close(resolve)); }
    return;
  }
  if(command==='review') {
    const publicReview=args.includes('--public');
    const report=await readJson(path.join(root,`qa/results/${publicReview?'public':'local'}-latest.json`));
    if(!args.includes('--reviewed') || !value('--note')?.trim()) throw new Error('Inspect the screenshots first, then use --reviewed --note "what was reviewed".');
    if(!report.passed || report.fingerprint!==await fingerprint(root)) throw new Error('Run a passing current browser verification first.');
    const review={status:'passed',fingerprint:report.fingerprint,reportId:report.id,note:value('--note'),reviewedAt:new Date().toISOString()};
    await writeJson(path.join(root,publicReview?'qa/public-visual-review.json':'qa/visual-review.json'),review);
    if(publicReview && await exists(path.join(root,'qa/results/deployment.json'))) {
      const deployment=await readJson(path.join(root,'qa/results/deployment.json'));
      if(deployment.publicReport!==report.id || deployment.fingerprint!==report.fingerprint) throw new Error('Public review does not match this deployment.');
      deployment.status='publicly-verified'; await writeJson(path.join(root,'qa/results/deployment.json'),deployment);
    }
    return print(review);
  }
  if(command==='deploy') {
    if(!args.includes('--dry-run') && !args.includes('--execute')) throw new Error('Use --dry-run or --execute');
    const check=await gate(root), configFile=path.join(root,'wrangler.json');
    if(!await exists(configFile)) throw new Error('No deployment target. Create a new named project or configure the intended account/target first.');
    const config=await readJson(configFile);
    if(!/^[a-z][a-z0-9-]{1,62}$/.test(config.name) || config.assets?.directory!=='./public' || config.routes || config.main || config.durable_objects) throw new Error('This static deploy harness requires a named public/-only target. Use the backend-specific release workflow for a live module.');
    const cli=resolveTool(root,'wrangler');
    const deployArgs=['deploy','--config',configFile,'--keep-vars'];
    if(args.includes('--dry-run')) { const out=runTool(cli,[...deployArgs,'--dry-run'],root); return print({status:'dry-run-passed',target:config.name,output:out.slice(-1200)}); }
    await writeJson(path.join(root,'public/build.json'),{fingerprint:check.fingerprint});
    const out=runTool(cli,deployArgs,root);
    const matches=[...out.matchAll(/https:\/\/[a-z\d.-]+\.workers\.dev/g)];
    const url=matches.at(-1)?.[0]; if(!url) throw new Error('Upload finished but no public URL was identified; inspect deployment in Cloudflare.');
    const deployment={target:config.name,url,fingerprint:check.fingerprint,status:'uploaded',deployedAt:new Date().toISOString()};
    await writeJson(path.join(root,'qa/results/deployment.json'),deployment);
    const report=await verifyBrowser(root,url,{publicRun:true,expectedBuild:check.fingerprint});
    deployment.status=report.passed?'public-browser-verified':'public-verification-failed';
    deployment.publicReport=report.id; await writeJson(path.join(root,'qa/results/deployment.json'),deployment);
    print({...deployment,errors:report.errors,visualReview:'Local screenshots reviewed; inspect public screenshots before final handoff.'});
    if(!report.passed) process.exitCode=1; return;
  }
  throw new Error(`Unknown command: ${command}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
