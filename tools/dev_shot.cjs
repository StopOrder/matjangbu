#!/usr/bin/env node
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/dev_shot.cjs <url> <out.png> [--mobile]
// 개발 중 화면 확인용. 1400×900(기본) 또는 390×844(--mobile). 콘솔 에러가 있으면 1 로 끝난다.
const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2); const mobile = process.argv.includes('--mobile');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await p.screenshot({ path: out, fullPage: false }); await b.close();
  console.log('찍음:', out); if (errors.length) { console.log('콘솔 에러:', errors); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
