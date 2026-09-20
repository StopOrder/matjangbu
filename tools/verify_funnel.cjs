#!/usr/bin/env node
// 공개 /try/ 가 Funnel 인스턴스에 붙어 끝까지 동작하는지 — 확인 큐에서 우리상사 → 김태섭 (4구역) 확정, W11 불러오기에서 별칭이 자동 적용되는지 단언하고 최종 화면을 찍는다. 0 = 전부 통과.
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_funnel.cjs --base https://stoporder.github.io/matjangbu --api https://<Funnel 주소>/ --resolve <호스트>=<공개 IP> --out docs/shots/08-public-funnel-w11.png [--trace]
// 확인 카드는 「다른 방법 ▾」([data-more])를 펼쳐야 직접 고르기 select 가 보인다(2026-09-21 React 화면).
// 대기는 전부 조건 대기다. #imp-progress 의 「끝」과 토스트는 일시 표시(load()→render() 가 화면을 다시 그리고, 토스트는 3.2초 뒤 사라짐)라 기준으로 삼지 않는다.
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', 'https://stoporder.github.io/matjangbu').replace(/\/$/, '');
const api = opt('--api', '');
const out = opt('--out', 'funnel-flow.png');
const trace = args.includes('--trace');
const resolve = args.filter((a, i) => args[i - 1] === '--resolve');
const launchArgs = resolve.length ? ['--host-resolver-rules=' + resolve.map(r => 'MAP ' + r.replace('=', ' ')).join(', ')] : [];
const fail = [];
const t0 = Date.now(); const ts = () => ((Date.now() - t0) / 1000).toFixed(2).padStart(6) + 's';
const check = (ok, msg) => { console.log(ts(), (ok ? '✓ ' : '✗ ') + msg); if (!ok) fail.push(msg); };
const log = (...a) => { if (trace) console.log(ts(), ...a); };
(async () => {
  const browser = await chromium.launch({ args: launchArgs });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); log('console.' + m.type(), m.text().slice(0, 200)); });
  page.on('request', r => { if (/\/api\//.test(r.url()) && !/\/try\/api\//.test(r.url())) log('→', r.method(), r.url().replace(/^https?:\/\/[^/]+/, ''), r.headers()['x-matjangbu-session'] ? 'sess' : 'nosess'); });
  page.on('response', r => { if (/\/api\//.test(r.url()) && !/\/try\/api\//.test(r.url())) log('←', r.status(), r.request().method(), r.url().replace(/^https?:\/\/[^/]+/, '')); });
  page.on('requestfailed', r => { if (/\/api\//.test(r.url())) log('✗ requestfailed', r.method(), r.url().replace(/^https?:\/\/[^/]+/, ''), r.failure() && r.failure().errorText); });

  // 1) 확인 큐 — 인스턴스에 붙었는지
  await page.goto(base + '/try/#/queue', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.matjangbuApiBase !== undefined && document.querySelectorAll('.qcard').length > 0, null, { timeout: 60000 }).catch(() => {});
  const banner = await page.locator('#banner:not([hidden])').count();
  check(banner === 0, '배너 없음');
  const apiBase = await page.evaluate(() => window.matjangbuApiBase);
  check(api ? apiBase === api : !!apiBase, 'API 주소 = ' + apiBase);
  const card = page.locator('.qcard', { hasText: '우리상사' });
  check(await card.count() === 1, '확인 큐에 우리상사 카드 ' + await card.count() + '장');

  // 2) 우리상사 → 김태섭 (4구역) 확정 — 카드가 큐에서 빠질 때까지 조건 대기
  if (await card.count()) {
    await card.locator('[data-more]').click();
    await card.locator('select[data-any]').selectOption({ label: '김태섭 (4구역)' });
    await card.locator('[data-pick-any]').click();
    const gone = await card.waitFor({ state: 'detached', timeout: 60000 }).then(() => true).catch(() => false);
    check(gone, '확정 뒤 카드가 큐에서 사라짐');
    const errToast = await page.locator('#toasts .toast.err').allTextContents();
    check(errToast.length === 0, '오류 토스트 없음' + (errToast.length ? ' ' + JSON.stringify(errToast) : ''));
  }

  // 3) W11 불러오기 — 결과 표에 우리상사 줄이 나타날 때까지 조건 대기
  await page.goto(base + '/try/#/import', { waitUntil: 'networkidle' });
  await page.locator('#imp-week option').first().waitFor({ state: 'attached', timeout: 60000 });   // <option> 은 visible 이 될 수 없다
  const wk = page.locator('#imp-week');
  const opts = await wk.locator('option').allTextContents();
  const w11 = opts.find(o => /W11/.test(o));
  check(!!w11, '샘플 주차 선택지 ' + JSON.stringify(opts) + (w11 ? ' → ' + w11 : ''));
  if (w11) await wk.selectOption({ label: w11 });
  const run = page.locator('#imp-run');
  check(await run.isEnabled(), '맞추기 버튼 활성');
  await run.click();
  // 화면은 열리자마자 현재 주차(W10) 표를 먼저 보여주므로, W11 머리글과 별칭으로 맞춘 우리상사 줄이 같이 나타날 때까지 기다린다
  const appeared = await page.waitForFunction(() => {
    const main = document.querySelector('main'); if (!main || !/2026-W11 맞추기 결과/.test(main.textContent)) return false;
    return Array.from(main.querySelectorAll('tr.row')).some(tr => /우리상사/.test(tr.textContent) && /별칭/.test(tr.textContent));
  }, null, { timeout: 120000 }).then(() => true).catch(() => false);
  check(appeared, 'W11 결과 표에 별칭으로 맞춘 우리상사 줄 출현');
  const row = page.locator('tr.row', { hasText: '우리상사' });
  const progErr = await page.locator('#imp-progress.err').allTextContents();
  check(progErr.length === 0, '진행 표시 오류 없음' + (progErr.length ? ' ' + JSON.stringify(progErr) : ''));
  const heading = await page.locator('main').textContent();
  check(/2026-W11 맞추기 결과/.test(heading), '결과 머리글에 2026-W11');
  const rowText = (await row.allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  check(rowText.length >= 1 && rowText.every(t => /김태섭/.test(t) && /별칭/.test(t)), 'W11 우리상사 줄: ' + JSON.stringify(rowText));
  // 스트림이 끝나면 load()→render() 가 화면을 다시 그리고 새 「맞추기」 버튼이 활성으로 온다 — 그 최종 화면을 찍는다
  await page.waitForFunction(() => { const b = document.querySelector('#imp-run'); return b && !b.disabled; }, null, { timeout: 60000 }).catch(() => {});
  await page.screenshot({ path: out });
  console.log(ts(), '찍음:', out);
  await browser.close();
  if (errors.length) { console.log('콘솔 에러:', errors); fail.push('console'); }
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
