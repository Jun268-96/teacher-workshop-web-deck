import fs from 'node:fs/promises';
import path from 'node:path';
import { loadPlaywright, fingerprint, readJson, writeJson, exists } from './lib.mjs';

const viewports = [
  {name:'desktop',width:1440,height:900}, {name:'projector',width:1366,height:768},
  {name:'tablet',width:1024,height:768}, {name:'phone',width:390,height:844}, {name:'phone-landscape',width:844,height:390}
];
const waitFor = async (callback, label) => {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) { if (await callback()) return; await new Promise(resolve=>setTimeout(resolve,100)); }
  throw new Error(`Expectation timed out: ${label}`);
};
export async function verifyBrowser(root,url,{publicRun=false,expectedBuild}={}) {
  const {chromium} = await loadPlaywright(root);
  const browser = await chromium.launch({headless:true});
  const id = `${new Date().toISOString().replace(/[:.]/g,'-')}-${publicRun?'public':'local'}`;
  const directory = path.join(root,'qa/results',id);
  await fs.mkdir(directory,{recursive:true});
  const report = { id, kind:publicRun?'public':'local', url, fingerprint:await fingerprint(root), passed:false, errors:[],warnings:[],checks:[],screenshots:[],manualVisualReview:'pending' };
  const fail = (message) => report.errors.push(message);
  const record = label => report.checks.push(label);
  const errorHandlers = page => {
    page.on('pageerror',error=>fail(`Browser exception: ${error.message}`));
    page.on('response',response=>{ if(response.status() >= 400) fail(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`); });
  };
  try {
    if (publicRun && expectedBuild) {
      const context = await browser.newContext();
      let matched=false, observed='unreachable';
      try {
        for(let attempt=0;attempt<4;attempt++) {
          if(attempt) await new Promise(resolve=>setTimeout(resolve,attempt*1500));
          try {
            const response=await context.request.get(new URL(`build.json?v=${expectedBuild}`,url).href,{timeout:5000});
            observed=String(response.status());
            if(response.ok()) { const marker=await response.json(); if(marker.fingerprint===expectedBuild) {matched=true;break;} observed='different build'; }
            if([401,403].includes(response.status())) break;
          } catch { observed='network or invalid marker'; }
        }
      } finally { await context.close(); }
      if(!matched) throw new Error(`Public build marker did not match after bounded readiness checks (${observed}). Retry public verification after checking the service; do not redeploy blindly.`);
      record('public-build-marker');
    }
    for (const viewport of viewports) {
      const context = await browser.newContext({viewport:{width:viewport.width,height:viewport.height},reducedMotion:'reduce'});
      const page = await context.newPage(); errorHandlers(page);
      await page.goto(url,{waitUntil:'load'}); await page.evaluate(()=>document.fonts.ready);
      const ids = await page.locator('#deck > .slide').evaluateAll(elements=>elements.map(el=>el.id));
      if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Slides need unique stable ids.');
      for (const slideId of ids) {
        await page.evaluate(id=>{ location.hash=id; },slideId);
        await page.locator(`#${slideId}.active`).waitFor();
        const metrics = await page.evaluate(() => {
          const deck = document.querySelector('#deck'), active = deck.querySelector('.active'), nav = document.querySelector('.deck-nav');
          const bounds = deck.getBoundingClientRect(), bad = [];
          for (const el of active.querySelectorAll('[data-qa]')) {
            if (!el.getClientRects().length) continue;
            const rect = el.getBoundingClientRect();
            if (rect.left < bounds.left-1 || rect.right > bounds.right+1 || el.scrollWidth > el.clientWidth+3) bad.push(el.id || el.className || el.tagName);
          }
          const intersections=[];
          for (const content of active.querySelectorAll('h1,h2,.cover-brand')) {
            const a=content.getBoundingClientRect();
            for (const fixed of document.querySelectorAll('.timer:not([hidden]),.brand-signature')) {
              if(!fixed.getClientRects().length || getComputedStyle(fixed).display==='none') continue;
              const b=fixed.getBoundingClientRect();
              if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2) intersections.push(content.id || content.className);
            }
          }
          const broken=[...active.querySelectorAll('img')].filter(el=>el.getClientRects().length && (!el.complete || !el.naturalWidth)).map(el=>el.getAttribute('src'));
          return {bad,intersections,broken,navBottom:nav.getBoundingClientRect().bottom,navTop:nav.getBoundingClientRect().top,deckBottom:bounds.bottom,viewportHeight:innerHeight,horizontal:document.documentElement.scrollWidth>innerWidth+1,scroll:deck.scrollHeight>deck.clientHeight+20,chars:active.innerText.replace(/\s/g,'').length};
        });
        if(metrics.bad.length || metrics.horizontal) fail(`${viewport.name}/${slideId}: horizontal clipping ${metrics.bad.join(',')}`);
        if(metrics.intersections.length) fail(`${viewport.name}/${slideId}: fixed controls overlap text ${metrics.intersections.join(',')}`);
        if(metrics.broken.length) fail(`${viewport.name}/${slideId}: broken images ${metrics.broken.join(',')}`);
        if(metrics.navBottom>viewport.height+1 || metrics.navTop<0 || metrics.deckBottom>metrics.navTop+1) fail(`${viewport.name}/${slideId}: footer geometry`);
        if(metrics.chars>320) report.warnings.push(`${viewport.name}/${slideId}: ${metrics.chars} visible characters; review density.`);
        if(metrics.scroll && viewport.width>=1024 && slideId!=='resources') report.warnings.push(`${viewport.name}/${slideId}: requires scrolling on a presentation viewport.`);
        const screenshot=path.join(directory,`${viewport.name}-${slideId}.png`);
        await page.screenshot({path:screenshot}); report.screenshots.push(path.relative(root,screenshot));
        if(metrics.scroll) {
          await page.locator('#deck').evaluate(el=>{el.scrollTop=el.scrollHeight;});
          const endpoint=path.join(directory,`${viewport.name}-${slideId}-end.png`);
          await page.screenshot({path:endpoint}); report.screenshots.push(path.relative(root,endpoint));
          const atEnd=await page.locator('#deck').evaluate(el=>Math.abs(el.scrollHeight-el.scrollTop-el.clientHeight)<3);
          if(!atEnd) fail(`${viewport.name}/${slideId}: cannot reach scroll endpoint`);
        }
      }
      await page.goto(new URL(`#${ids[1]||ids[0]}`,url).href); await page.reload();
      await page.locator(`#${ids[1]||ids[0]}.active`).waitFor(); record(`${viewport.name}: deep-link reload and ${ids.length} slides`);
      await context.close();
    }
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    const page=await context.newPage(); errorHandlers(page); await page.goto(new URL('#start',url).href);
    await page.locator('[data-next]').click();
    const second=await page.locator('.slide.active').getAttribute('id');
    await page.locator('[data-next]').focus(); await page.keyboard.press('ArrowRight');
    if(await page.locator('.slide.active').getAttribute('id')===second) fail('Arrow navigation blocked by focused button'); else record('focused-button keyboard navigation');
    await page.locator('#toc-toggle').hover(); await page.locator('#contents').waitFor({state:'visible'}); record('hover table of contents');
    await page.keyboard.press('Escape');
    await page.locator('#toc-toggle').click(); await page.locator('#contents button').first().click();
    if(await page.locator('.slide.active').getAttribute('id')!=='start') fail('TOC jump failed'); else record('touch/click table of contents');
    if(await page.locator('[data-timer]').isVisible()) {
      await page.locator('#timer-toggle').hover(); await page.locator('#timer-start').click();
      await page.waitForTimeout(1100); await page.locator('#timer-reset').click();
      const config=await page.evaluate(()=>window.WORKSHOP_CONFIG);
      const expected=`${config.durationMinutes}:00`;
      if(await page.locator('#timer-output').textContent()!==expected) fail('Timer reset failed'); else record('timer start and reset');
    }
    await page.locator('#deck').click({position:{x:700,y:150}}); await page.keyboard.press('f');
    await waitFor(()=>page.evaluate(()=>!!document.fullscreenElement),'fullscreen entry');
    { if(!await page.locator('.deck-nav').isVisible()) fail('Footer missing in fullscreen'); await page.evaluate(()=>document.exitFullscreen()); record('fullscreen with persistent controls'); }
    await context.close();
    const flows=await readJson(path.join(root,'qa/flows.json'));
    for(const flow of flows.flows||[]) {
      if(publicRun && !flow.publicSafe) { fail(`Flow ${flow.name} has not been approved for public fixture execution (publicSafe).`); continue; }
      const contexts=[],sessions={};
      try {
        for(const [name,route] of Object.entries(flow.sessions)) {
          const target=new URL(route,url); if(target.origin!==new URL(url).origin) throw new Error('Cross-origin flow routes are not allowed');
          const ctx=await browser.newContext({viewport:{width:1366,height:768}}); contexts.push(ctx); sessions[name]=await ctx.newPage(); errorHandlers(sessions[name]); await sessions[name].goto(target.href);
        }
        for(const step of flow.steps) {
          const p=sessions[step.session]; if(!p) throw new Error(`Unknown session ${step.session}`);
          const locator=step.selector ? p.locator(step.selector) : null;
          switch(step.action) {
            case 'click': await locator.click(); break;
            case 'fill': await locator.fill(step.value); break;
            case 'press': await locator.press(step.value); break;
            case 'reload': await p.reload(); break;
            case 'goto': { const target=new URL(step.value,url); if(target.origin!==new URL(url).origin) throw new Error('Cross-origin route'); await p.goto(target.href); break; }
            case 'expectText': await waitFor(async()=>await locator.textContent()===step.value,step.selector); break;
            case 'expectValue': await waitFor(async()=>await locator.inputValue()===step.value,step.selector); break;
            case 'expectVisible': await locator.waitFor({state:'visible'}); break;
            case 'expectHidden': await locator.waitFor({state:'hidden'}); break;
            case 'expectDisabled': await waitFor(()=>locator.isDisabled(),step.selector); break;
            case 'expectCount': await waitFor(async()=>await locator.count()===step.value,step.selector); break;
            default: throw new Error(`Unsupported flow action ${step.action}`);
          }
        }
        record(`flow: ${flow.name} (${Object.keys(sessions).length} isolated sessions)`);
      } catch(error) { fail(`Flow ${flow.name}: ${error.message}`); }
      finally { await Promise.all(contexts.map(ctx=>ctx.close())); }
    }
    record('reduced-motion captures');
  } catch(error) { fail(error.message); }
  finally {
    await browser.close(); report.passed=report.errors.length===0;
    await writeJson(path.join(directory,'report.json'),report);
    await writeJson(path.join(root,`qa/results/${publicRun?'public':'local'}-latest.json`),report);
  }
  return report;
}
