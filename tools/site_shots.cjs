#!/usr/bin/env node
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/site_shots.cjs <출력폴더> [--base http://127.0.0.1:8108]
// 1600×900 — 01-landing · 02-queue(확인 큐) · 03-import-done(W11 맞추기 뒤) · 04-records · 05-dashboard · 06-drawer(줄 상세)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const args = process.argv.slice(2); const out = args[0] || 'docs/shots';
const base = (args[args.indexOf('--base') + 1] || 'http://127.0.0.1:8108').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = n => page.screenshot({ path: path.join(out, n + '.png') });
  await page.goto(base + '/', { waitUntil: 'networkidle' }); await shot('01-landing');
  await page.goto(base + '/try/#/queue', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await shot('02-queue');
  // 확인 큐에서 우리상사 → 김태섭 확정(후보에 없으면 새 이름 폼 대신 첫 후보)
  const card = page.locator('.qcard', { hasText: '우리상사' });
  if (await card.count()) { await card.locator('select[data-any]').selectOption({ label: '김태섭 (4구역)' }); await card.locator('[data-pick-any]').click(); await page.waitForTimeout(800); }
  await page.goto(base + '/try/#/import', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const run = page.locator('#imp-run');
  if (await run.count() && await run.isEnabled()) { await run.click(); await page.waitForFunction(() => /끝|실패/.test((document.querySelector('#imp-progress') || {}).textContent || ''), null, { timeout: 120000 }); await page.waitForTimeout(600); }
  await shot('03-import-done');
  await page.goto(base + '/try/#/records', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await shot('04-records');
  await page.goto(base + '/try/#/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await shot('05-dashboard');
  await page.goto(base + '/try/#/import', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const row = page.locator('tr.row').first(); if (await row.count()) { await row.click(); await page.waitForTimeout(400); } await shot('06-drawer');
  await page.goto(base + '/try/#/envelope', { waitUntil: 'networkidle' }); await page.waitForTimeout(400); await shot('07-envelope');
  await browser.close();
  console.log('찍음:', fs.readdirSync(out).filter(f => f.endsWith('.png')).join(' '));
  if (errors.length) { console.log('콘솔 에러:', errors); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
