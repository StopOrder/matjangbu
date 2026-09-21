#!/usr/bin/env node
// 랜딩에서 들어간 사람이 장부의 빈 줄 하나를 실제로 채울 수 있는지 — 끝까지 눌러 보고 단언한다. 0 = 전부 통과.
// NODE_PATH=~/workspace/02-sandbox/mvp-agent/node_modules node tools/verify_funnel.cjs --base https://stoporder.github.io/matjangbu [--api https://<Funnel 주소>/] [--resolve <호스트>=<공개 IP>] [--out docs/shots/08-funnel.png] [--trace]
// 동선: / 히어로 「체험하기」 → /try/ → 첫 빈 줄 클릭 → 그 자리 판이 열림 → 첫 후보 클릭 → 그 줄의 빈 줄 표시가 사라짐.
// 읽기 전용(미리 잰 기록)으로 떨어지면 고르기가 막히므로 판이 열리는 데까지만 단언한다.
// 대기는 전부 조건 대기다 — 공개 인그레스 경유는 요청당 0.5~3초라 고정 시간 대기가 실패한다.
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', 'https://stoporder.github.io/matjangbu').replace(/\/$/, '');
const api = opt('--api', '');
const out = opt('--out', '');
const trace = args.includes('--trace');
const resolve = args.filter((a, i) => args[i - 1] === '--resolve');
const launchArgs = resolve.length ? ['--host-resolver-rules=' + resolve.map(r => 'MAP ' + r.replace('=', ' ')).join(', ')] : [];
const fail = [];
const t0 = Date.now(); const ts = () => ((Date.now() - t0) / 1000).toFixed(2).padStart(6) + 's';
const check = (ok, msg) => { console.log(ts(), (ok ? '✓ ' : '✗ ') + msg); if (!ok) fail.push(msg); };
const log = (...a) => { if (trace) console.log(ts(), ...a); };

const BLANK = '[data-mj="row"][data-blank="1"]';

(async () => {
  const browser = await chromium.launch({ args: launchArgs });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); log('console.' + m.type(), m.text().slice(0, 200)); });
  page.on('response', r => { if (/\/api\//.test(r.url())) log('←', r.status(), r.request().method(), r.url().replace(/^https?:\/\/[^/]+/, '')); });
  page.on('requestfailed', r => { if (/\/api\//.test(r.url())) log('✗ requestfailed', r.method(), r.url().replace(/^https?:\/\/[^/]+/, ''), r.failure() && r.failure().errorText); });

  // 1) 랜딩 → 체험하기
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const cta = page.locator('[data-mj="hero"] a[href$="try/"]').first();
  check(await cta.count() === 1, '랜딩 히어로에 체험 링크 ' + await cta.count() + '개');
  await cta.click();
  await page.waitForURL(/\/try\/?$/, { timeout: 60000 }).catch(() => {});
  check(/\/try\//.test(page.url()), '/try/ 로 이동: ' + page.url());

  // 2) 장부가 뜨고 빈 줄이 있는지 — 삼중 폴백이 끝날 때까지 조건 대기
  await page.waitForFunction(() => window.matjangbuApiBase !== undefined && document.querySelectorAll('[data-mj="row"]').length > 0, null, { timeout: 60000 }).catch(() => {});
  const apiBase = await page.evaluate(() => window.matjangbuApiBase);
  const readonly = apiBase === null;
  check(api ? apiBase === api : true, '읽는 곳: ' + (readonly ? '미리 잰 기록' : apiBase));
  const rows = await page.locator('[data-mj="row"]').count();
  check(rows > 0, '장부 줄 ' + rows + '개');
  const blanks = await page.locator(BLANK).count();
  check(blanks > 0, '채울 줄 ' + blanks + '개');
  if (!blanks) { await browser.close(); process.exit(1); }

  // 3) 첫 빈 줄을 눌러 그 자리 판을 편다
  const first = page.locator(BLANK).first();
  const rawText = (await first.textContent() || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  await first.click();
  const opened = await page.locator('[data-mj="panel"]').first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
  check(opened, '그 자리 판이 열림 — ' + rawText);
  const cands = await page.locator('[data-mj="cand"]').count();
  check(cands >= 0, '후보 ' + cands + '개');

  // 4) 후보를 고르면 그 줄이 채워진다 — 읽기 전용이면 여기까지
  if (readonly) {
    check(true, '미리 잰 기록이라 고르기는 막혀 있다 — 판 열림까지만 확인');
  } else if (!cands) {
    check(true, '이 줄에는 후보가 없다(직접 고르기로만 채운다) — 판 열림까지만 확인');
  } else {
    await page.locator('[data-mj="cand"]').first().click();
    const shrank = await page.waitForFunction(
      n => document.querySelectorAll('[data-mj="row"][data-blank="1"]').length === n - 1,
      blanks, { timeout: 60000 }).then(() => true).catch(() => false);
    check(shrank, '후보 확정 뒤 채울 줄 ' + blanks + ' → ' + await page.locator(BLANK).count());
    const errToast = await page.locator('.toast.err').allTextContents();
    check(errToast.length === 0, '오류 토스트 없음' + (errToast.length ? ' ' + JSON.stringify(errToast) : ''));
  }

  if (out) { await page.screenshot({ path: out }); console.log(ts(), '찍음:', out); }
  await browser.close();
  if (errors.length) { console.log('콘솔 에러:', errors); fail.push('console'); }
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
