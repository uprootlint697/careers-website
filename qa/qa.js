// Production QA for the careers page: real Chromium, desktop + mobile, live API,
// API-down and API-empty paths, filters, basic a11y. Prints a JSON report.
const { chromium } = require('playwright');
const path = require('path');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const OUT = path.join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });
const report = { pass: [], fail: [] };
const ok = (name, cond, detail) => (cond ? report.pass : report.fail).push(name + (detail ? ` — ${detail}` : ''));

(async () => {
  const browser = await chromium.launch();

  // ---------- 1. Desktop, live API ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [], failedReqs = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('requestfailed', r => failedReqs.push(r.url()));
    const apiResp = page.waitForResponse(r => r.url().includes('api.ashbyhq.com'), { timeout: 15000 }).catch(() => null);
    await page.goto(PAGE);
    const resp = await apiResp;
    await page.keyboard.press('Tab');
    ok('a11y: skip link is first tab stop', (await page.evaluate(() => document.activeElement.className)) === 'skip-link');
    await page.keyboard.press('Enter');
    ok('a11y: skip link jumps to #main', await page.evaluate(() => location.hash === '#main'));
    ok('desktop: Ashby API responded 200', resp && resp.status() === 200, resp ? String(resp.status()) : 'no response');
    await page.waitForSelector('.role', { timeout: 15000 });
    const n = await page.locator('.role').count();
    ok('desktop: roles rendered', n > 0, `${n} roles`);
    ok('desktop: hero count matches list', (await page.locator('#open-count').innerText()) === String(n));
    ok('desktop: loading status hidden', await page.locator('#roles-status').isHidden());
    ok('desktop: no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    ok('desktop: no failed requests', failedReqs.length === 0, failedReqs.join(' | '));
    ok('desktop: exactly one h1', (await page.locator('h1').count()) === 1);
    ok('desktop: title', (await page.title()) === 'Careers — Uproot Clean');
    ok('desktop: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('desktop: Poppins loaded', await page.evaluate(() => document.fonts.check('800 16px Poppins')));
    ok('desktop: nav links visible at 1280', await page.locator('.nav-links a').first().isVisible());
    // hero team-photo slot + live badge
    const img = await page.evaluate(() => { const i = document.querySelector('.hero-photo img'); return i && { w: i.naturalWidth, h: i.naturalHeight, complete: i.complete, ratio: +(i.getBoundingClientRect().width / i.getBoundingClientRect().height).toFixed(2) }; });
    ok('hero: team image slot renders (placeholder decoded)', img && img.complete && img.w > 0, JSON.stringify(img));
    ok('hero: image slot is 4:5', img && Math.abs(img.ratio - 0.8) < 0.03, `${img && img.ratio}`);
    ok('hero: live badge sits inside photo', await page.evaluate(() => { const p = document.querySelector('.hero-photo').getBoundingClientRect(), b = document.querySelector('.hero-badge').getBoundingClientRect(); return b.left >= p.left && b.right <= p.right && b.bottom <= p.bottom; }));
    // retailer logos
    const logos = await page.$$eval('.retailer-bar .logo-svg', els => els.map(e => ({ name: e.getAttribute('aria-label'), w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
    ok('retailers: 4 logo SVGs with labels', logos.length === 4 && logos.map(l => l.name).join() === 'Amazon,Walmart,Target,Petco', logos.map(l => l.name).join());
    ok('retailers: logos have real size (Target bullseye is square)', logos.every(l => l.w >= 28 && l.h >= 20 && l.h <= 32), JSON.stringify(logos));
    ok('retailers: no leaked svg class rules', await page.evaluate(() => !document.querySelector('.retailer-bar svg style')));
    const stepCols = await page.evaluate(() => getComputedStyle(document.querySelector('.steps')).gridTemplateColumns.split(' ').length);
    ok('desktop: interview steps 4 columns', stepCols === 4, `${stepCols}`);

    // filters
    const chips = page.locator('#role-filters .chip');
    const chipCount = await chips.count();
    ok('filters: chips rendered (All + departments)', chipCount >= 3, `${chipCount}`);
    await chips.nth(1).click();
    const dept = await chips.nth(1).getAttribute('data-dept');
    const visible = await page.locator('.role:visible').count();
    const expected = await page.locator(`.role[data-dept="${dept}"]`).count();
    ok(`filters: "${dept}" shows only its roles`, visible === expected && visible < n, `${visible}/${n}`);
    ok('filters: aria-pressed moved', (await chips.nth(1).getAttribute('aria-pressed')) === 'true' && (await chips.nth(0).getAttribute('aria-pressed')) === 'false');
    await chips.nth(0).click();
    ok('filters: All restores', (await page.locator('.role:visible').count()) === n);

    // links
    const hrefs = await page.$$eval('.role', as => as.map(a => ({ href: a.href, t: a.target, r: a.rel })));
    ok('roles: every link → Ashby posting with UTM, new tab, noopener',
      hrefs.every(h => /^https:\/\/jobs\.ashbyhq\.com\/uprootclean\/[0-9a-f-]{36}\?utm_source=uprootclean\.com&utm_medium=careers-page$/.test(h.href) && h.t === '_blank' && h.r === 'noopener'));

    // in-page anchors resolve
    const anchors = await page.$$eval('a[href^="#"]', as => [...new Set(as.map(a => a.getAttribute('href')))]);
    const missing = [];
    for (const a of anchors) if (!(await page.locator(a).count())) missing.push(a);
    ok('anchors: all in-page targets exist', missing.length === 0, missing.join(','));

    // review-language sweep on rendered text
    const text = await page.evaluate(() => document.body.innerText);
    const leaks = ['provisional', 'draft', 'placeholder', 'preview', 'not for ship', 'internal'].filter(w => text.toLowerCase().includes(w));
    ok('copy: no review language in rendered text', leaks.length === 0, leaks.join(','));

    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.activeElement && document.activeElement.blur(); document.scrollingElement.scrollTop = 0; window.scrollTo(0, 0); });
    const atTop = await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 3000 }).then(() => true).catch(() => false);
    ok('screenshot prep: at top of page', atTop, await page.evaluate(() => `scrollY=${window.scrollY} hash=${location.hash} active=${document.activeElement && document.activeElement.tagName}`));
    await page.screenshot({ path: path.join(OUT, 'desktop-hero.png') });
    await page.locator('#culture').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'desktop-company.png') });
    await page.locator('#hire').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'desktop-hire.png') });
    await page.locator('#roles').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'desktop-roles.png') });
    await page.locator('#loop').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'desktop-loop.png') });
    await page.screenshot({ path: path.join(OUT, 'desktop-full.png'), fullPage: true });
    await ctx.close();
  }

  // ---------- 2. Mobile ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(PAGE);
    await page.waitForSelector('.role', { timeout: 15000 });
    ok('mobile: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.hero-grid')).gridTemplateColumns.split(' ').length);
    ok('mobile: hero stacks to 1 column', cols === 1, `${cols}`);
    ok('mobile: nav CTA visible', await page.locator('.nav-inner > .btn').isVisible());
    await page.screenshot({ path: path.join(OUT, 'mobile-top.png') });
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    await page.locator('.hero-photo').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'mobile-hero-photo.png') });
    await page.locator('.retailer-bar').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'mobile-retailers.png') });
    await page.locator('#roles').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'mobile-roles.png') });
    await page.screenshot({ path: path.join(OUT, 'mobile-full.png'), fullPage: true });
    await ctx.close();
  }

  // ---------- 3. API down ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.route('**/api.ashbyhq.com/**', r => r.abort());
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(PAGE);
    await page.waitForFunction(() => !document.getElementById('roles-status').classList.contains('loading'), null, { timeout: 15000 });
    const st = page.locator('#roles-status');
    ok('api-down: fallback message shown', (await st.innerText()).includes("couldn’t load"), await st.innerText());
    ok('api-down: fallback links to job board', (await st.locator('a[href="https://jobs.ashbyhq.com/uprootclean"]').count()) === 1);
    ok('api-down: hero count shows —', (await page.locator('#open-count').innerText()) === '—');
    ok('api-down: no uncaught page errors', errs.length === 0, errs.join(' | '));
    ok('api-down: no chips rendered', (await page.locator('.chip').count()) === 0);
    await page.screenshot({ path: path.join(OUT, 'api-down.png'), fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 900 } }).catch(() => {});
    await ctx.close();
  }

  // ---------- 4. API returns zero jobs ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.route('**/api.ashbyhq.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ apiVersion: '1', jobs: [] }) }));
    await page.goto(PAGE);
    await page.waitForFunction(() => !document.getElementById('roles-status').classList.contains('loading'), null, { timeout: 15000 });
    ok('api-empty: "No open roles" message', (await page.locator('#roles-status').innerText()).includes('No open roles'));
    ok('api-empty: hero count 0', (await page.locator('#open-count').innerText()) === '0');
    await ctx.close();
  }

  // ---------- 5. API returns hostile title (XSS escape) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    let dialog = false;
    page.on('dialog', d => { dialog = true; d.dismiss(); });
    const job = { id: 'x', title: '<img src=x onerror=alert(1)>Evil & Co', department: '<b>Dept</b>', location: 'US', isRemote: true, employmentType: 'FullTime', isListed: true, jobUrl: 'https://jobs.ashbyhq.com/uprootclean/x' };
    await page.route('**/api.ashbyhq.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ jobs: [job] }) }));
    await page.goto(PAGE);
    await page.waitForSelector('.role');
    await page.waitForTimeout(500);
    ok('xss: title escaped, no injected img', (await page.locator('.role img').count()) === 0 && !dialog);
    ok('xss: dept tag escaped', (await page.locator('.tag b').count()) === 0);
    await ctx.close();
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  console.log(`\n${report.pass.length} passed, ${report.fail.length} failed`);
  process.exit(report.fail.length ? 1 : 0);
})().catch(e => { console.error('QA crashed:', e); process.exit(2); });
