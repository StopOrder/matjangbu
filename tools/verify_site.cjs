#!/usr/bin/env node
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base http://127.0.0.1:8123 [--expect-banner] [--allow https://인스턴스] [--resolve 호스트=IP]
// 네 경로: 외부 요청 0 · 콘솔 에러 0 · <h1> 존재. --expect-banner 면 /try/ 에 앰버 배너가 보여야 하고, 아니면 보이면 안 된다.
// --resolve: 테일넷 안의 머신은 Funnel 호스트가 MagicDNS 로 100.x 로 풀려 Chromium 이 「local 주소 공간」이라며 fetch 를 막는다.
//            공개 IP(구글 DoH 로 조회) 로 고정하면 외부 방문자와 같은 경로로 붙는다.
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = (opt('--base', 'http://127.0.0.1:8123')).replace(/\/$/, '');
const expectBanner = args.includes('--expect-banner');
const allow = args.filter((a, i) => args[i - 1] === '--allow').map(u => new URL(u).origin);
const resolve = args.filter((a, i) => args[i - 1] === '--resolve');
const launchArgs = resolve.length ? ['--host-resolver-rules=' + resolve.map(r => 'MAP ' + r.replace('=', ' ')).join(', ')] : [];
const origin = new URL(base).origin;
(async () => {
  const browser = await chromium.launch({ args: launchArgs });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const external = [], errors = [];
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !allow.some(a => u.startsWith(a))) external.push(u); });
  const bad4xx = [];
  page.on('response', r => { if (r.status() >= 400 && !/\/api\//.test(r.url())) bad4xx.push(r.status() + ' ' + r.url()); });
  // api 탐색 404 는 폴백 설계상 정상 — 정적 4xx 는 response 로 잡는다.
  // --expect-banner 일 때 허용 출처(--allow)에 대한 CORS 차단 메시지도 정상 — 인스턴스가 죽으면 Funnel 인그레스가 CORS 헤더 없는 502 를 주고, 그 실패가 곧 폴백의 계기다.
  const corsBlockedOnAllowed = t => expectBanner && /blocked by CORS policy/.test(t) && allow.some(a => t.includes("'" + a));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) && !corsBlockedOnAllowed(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  let bad = 0;
  for (const p of ['/', '/try/', '/download/', '/phone/']) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    const h1 = await page.locator('h1').count();
    if (h1 < 1) { console.log(`✗ ${p}: <h1> 없음`); bad++; } else console.log(`✓ ${p}: h1 ${h1}`);
    if (p === '/try/') {
      await page.waitForTimeout(1500);
      const banner = await page.locator('#banner:not([hidden])').count();
      if (expectBanner !== (banner > 0)) { console.log(`✗ /try/: 배너 ${banner > 0 ? '보임' : '없음'} (기대: ${expectBanner ? '보임' : '없음'})`); bad++; } else console.log(`✓ /try/: 배너 ${banner > 0 ? '보임' : '없음'}`);
      await page.goto(base + p + '#/import', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
      const rows = await page.locator('main table tbody tr').count();
      if (rows < 1) { console.log('✗ /try/#/import: 표가 비어 있다'); bad++; } else console.log(`✓ /try/#/import: 표 ${rows}행`);
    }
  }
  if (external.length) { console.log('✗ 외부 요청:', [...new Set(external)]); bad++; } else console.log('✓ 외부 요청 0');
  if (errors.length) { console.log('✗ 콘솔 에러:', errors); bad++; } else console.log('✓ 콘솔 에러 0');
  if (bad4xx.length) { console.log('✗ 정적 4xx:', [...new Set(bad4xx)]); bad++; } else console.log('✓ 정적 4xx 0');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
