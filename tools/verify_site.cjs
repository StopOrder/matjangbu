#!/usr/bin/env node
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_site.cjs --base http://127.0.0.1:8123 [--expect-recorded] [--allow https://인스턴스] [--resolve 호스트=IP]
// 세 경로(/ · /install/ · /try/): 외부 요청 0 · 콘솔 에러 0 · 정적 4xx 0 · 모바일 390px 가로 넘침 0,
// 그리고 화면마다 DOM 계약(data-mj=…)이 서 있는지.
// --expect-recorded: 인스턴스가 죽어 「미리 잰 기록」으로 떨어져야 하는 상황을 단언한다(window.matjangbuApiBase === null).
//                    붙이지 않으면 반대로 인스턴스에 붙어 있어야 한다.
// --resolve: 테일넷 안의 머신은 Funnel 호스트가 MagicDNS 로 100.x 로 풀려 Chromium 이 「local 주소 공간」이라며 fetch 를 막는다.
//            공개 IP(구글 DoH 로 조회) 로 고정하면 외부 방문자와 같은 경로로 붙는다.
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = (opt('--base', 'http://127.0.0.1:8123')).replace(/\/$/, '');
const expectRecorded = args.includes('--expect-recorded') || args.includes('--expect-banner');
const allow = args.filter((a, i) => args[i - 1] === '--allow').map(u => new URL(u).origin);
const resolve = args.filter((a, i) => args[i - 1] === '--resolve');
const launchArgs = resolve.length ? ['--host-resolver-rules=' + resolve.map(r => 'MAP ' + r.replace('=', ' ')).join(', ')] : [];
const origin = new URL(base).origin;

// 화면 하나가 지켜야 할 것 — [선택자, 최소, 최대(없으면 무한)]
const CONTRACT = {
  '/': [
    ['[data-mj="gnb"]', 1, 1], ['[data-mj="hero"]', 1, 1], ['[data-mj="matrix"]', 1, 1],
    ['[data-mj="opt"][data-on="1"]', 5], ['[data-mj="out"]', 1, 1], ['h1', 1],
  ],
  '/install/': [['[data-mj="gnb"]', 1, 1], ['[data-mj="hero"]', 1, 1], ['h1', 1]],
  '/try/': [
    ['[data-mj="gnb"]', 1, 1], ['[data-mj="tab"]', 4, 4], ['[data-mj="ledger"]', 1, 1],
    ['[data-mj="entry"]', 1, 1], ['[data-mj="total"]', 1, 1], ['[data-mj="row"]', 1], ['h1', 1],
  ],
};

(async () => {
  const browser = await chromium.launch({ args: launchArgs });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const external = [], errors = [], bad4xx = [];
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !allow.some(a => u.startsWith(a))) external.push(u); });
  // api 탐색 404 는 삼중 폴백 설계상 정상 — 정적 4xx 만 잡는다.
  page.on('response', r => { if (r.status() >= 400 && !/\/api\//.test(r.url())) bad4xx.push(r.status() + ' ' + r.url()); });
  // 인스턴스가 죽으면 인그레스가 CORS 헤더 없는 502 를 준다. 그 차단 메시지가 곧 폴백의 계기라 에러로 세지 않는다.
  const corsBlockedOnAllowed = t => expectRecorded && /blocked by CORS policy/.test(t) && allow.some(a => t.includes("'" + a));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) && !corsBlockedOnAllowed(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  let bad = 0;
  const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if (!ok) bad++; };

  for (const [p, rules] of Object.entries(CONTRACT)) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    if (p === '/try/') await page.waitForTimeout(1500);        // 삼중 폴백이 끝날 때까지
    for (const [sel, min, max] of rules) {
      const n = await page.locator(sel).count();
      check(n >= min && (max === undefined || n <= max), `${p} ${sel}: ${n}개 (기대 ${min}${max === undefined ? '+' : max === min ? '' : '~' + max})`);
    }
    if (p === '/try/') {
      const apiBase = await page.evaluate(() => window.matjangbuApiBase);
      const recorded = apiBase === null;
      check(recorded === expectRecorded, `/try/ ${recorded ? '미리 잰 기록' : '인스턴스 ' + apiBase} (기대: ${expectRecorded ? '미리 잰 기록' : '인스턴스'})`);
    }
  }

  // 모바일 390px — 가로로 넘치는 화면이 하나라도 있으면 실패
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  m.on('pageerror', e => errors.push(String(e)));
  for (const p of Object.keys(CONTRACT)) {
    await m.goto(base + p, { waitUntil: 'networkidle' });
    if (p === '/try/') await m.waitForTimeout(1500);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(over === 0, `${p} 390px 가로 넘침 ${over}px`);
  }
  await m.close();

  check(external.length === 0, external.length ? '외부 요청: ' + JSON.stringify([...new Set(external)]) : '외부 요청 0');
  check(errors.length === 0, errors.length ? '콘솔 에러: ' + JSON.stringify(errors) : '콘솔 에러 0');
  check(bad4xx.length === 0, bad4xx.length ? '정적 4xx: ' + JSON.stringify([...new Set(bad4xx)]) : '정적 4xx 0');
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
