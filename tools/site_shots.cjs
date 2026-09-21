#!/usr/bin/env node
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/site_shots.cjs <출력폴더> [--base http://127.0.0.1:8108]
// 1400×900(데스크톱)·390×844(모바일) — 01-landing · 02-landing-mobile · 03-install ·
// 04-week · 05-week-panel(빈 줄을 펼친 상태) · 06-year · 07-roster · 08-settings · 09-week-mobile
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const args = process.argv.slice(2); const out = args[0] || 'docs/shots';
const base = (args[args.indexOf('--base') + 1] || 'http://127.0.0.1:8108').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const BLANK = '[data-mj="row"][data-blank="1"]';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); };
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  watch(page);
  const shot = n => page.screenshot({ path: path.join(out, n + '.png') });
  // 장부가 다 뜰 때까지 기다린다 — 삼중 폴백이 끝나야 줄이 생긴다
  const ledger = async hash => {
    await page.goto(base + '/try/#/' + hash, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.matjangbuApiBase !== undefined, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(700);
  };

  await page.goto(base + '/', { waitUntil: 'networkidle' }); await shot('01-landing');
  await page.goto(base + '/install/', { waitUntil: 'networkidle' }); await shot('03-install');
  await ledger('week'); await shot('04-week');
  const blank = page.locator(BLANK).first();
  if (await blank.count()) { await blank.click(); await page.locator('[data-mj="panel"]').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {}); await page.waitForTimeout(300); }
  await shot('05-week-panel');
  await ledger('year'); await shot('06-year');
  await ledger('roster'); await shot('07-roster');
  await ledger('settings'); await shot('08-settings');
  await page.close();

  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(m);
  await m.goto(base + '/', { waitUntil: 'networkidle' }); await m.screenshot({ path: path.join(out, '02-landing-mobile.png') });
  await m.goto(base + '/try/#/week', { waitUntil: 'networkidle' });
  await m.waitForFunction(() => window.matjangbuApiBase !== undefined, null, { timeout: 60000 }).catch(() => {});
  await m.waitForTimeout(700);
  await m.screenshot({ path: path.join(out, '09-week-mobile.png') });
  await browser.close();

  console.log('찍음:', fs.readdirSync(out).filter(f => f.endsWith('.png')).sort().join(' '));
  if (errors.length) { console.log('콘솔 에러:', errors); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
