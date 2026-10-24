import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {serve, loadPlaywright, resolveTool} from '../assets/starter-deck/harness/lib.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const starter = path.join(repo, 'assets/starter-deck');
const browserOptions = {skip: !resolveTool(starter, 'playwright') && 'Playwright unavailable'};

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workshop-time-'));
  await fs.cp(starter, root, {recursive: true});
  const preview = await serve(root);
  const {chromium} = await loadPlaywright(root);
  const browser = await chromium.launch({headless: true});
  t.after(async () => {
    await browser.close();
    await new Promise(resolve => preview.server.close(resolve));
    await fs.rm(root, {recursive: true, force: true});
  });
  return {root, preview, browser};
}

test('new deck has no invented duration label or timer', browserOptions, async t => {
  const {preview, browser} = await fixture(t);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(preview.url);
  const config = await page.evaluate(() => window.WORKSHOP_CONFIG);
  assert.equal(config.durationMinutes, null);
  assert.equal(config.modules.timer, false);
  assert.equal(await page.locator('[data-duration-label]').isVisible(), false);
  assert.equal(await page.locator('[data-duration]').textContent(), '');
  assert.equal(await page.locator('[data-timer]').isVisible(), false);
  await page.locator('[data-next]').click();
  assert.equal(await page.locator('.slide.active').getAttribute('id'), 'chapter');
  assert.deepEqual(errors, []);
});

test('timer requires a valid configured duration and resets to that exact duration', browserOptions, async t => {
  const {root, preview, browser} = await fixture(t);
  const configPath = path.join(root, 'public/config.js');
  const original = await fs.readFile(configPath, 'utf8');
  for (const value of [null, 0, -5, '미정', 27.5]) {
    await fs.writeFile(configPath, original.replace('durationMinutes: null', `durationMinutes: ${JSON.stringify(value)}`).replace('timer: false', 'timer: true'));
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(preview.url);
    const enabled = value === 27.5;
    assert.equal(await page.locator('[data-timer]').isVisible(), enabled, String(value));
    assert.equal(await page.locator('[data-duration-label]').isVisible(), enabled, String(value));
    if (enabled) {
      assert.equal(await page.locator('#timer-output').textContent(), '27:30');
      await page.locator('#timer-toggle').hover();
      await page.locator('#timer-start').click();
      await page.waitForFunction(() => document.querySelector('#timer-output').textContent !== '27:30');
      await page.locator('#timer-reset').click();
      assert.equal(await page.locator('#timer-output').textContent(), '27:30');
      assert.equal(await page.locator('#timer-start').textContent(), '시작');
    }
    await context.close();
  }
});
