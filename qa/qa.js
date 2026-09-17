// Production QA for the careers page: real Chromium, desktop + mobile, live API,
// API-down and API-empty paths, filters, basic a11y. Prints a JSON report.
const { chromium } = require('playwright');
const path = require('path');

// Serve the repo over HTTP like production; the file: scheme forbids fetch('roles/index.json').
const http = require('http'), fs = require('fs');
const SITE = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const p = path.join(SITE, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(SITE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(res);
});
const PORT = 4173 + Math.floor(Math.random() * 500);
// QA_ORIGIN=https://careers.uprootclean.com npm run qa  -> test the deployed site instead of the local copy
const REMOTE = process.env.QA_ORIGIN ? process.env.QA_ORIGIN.replace(/\/$/, '') : '';
const ORIGIN = REMOTE || `http://127.0.0.1:${PORT}`;
const PAGE = ORIGIN + '/index.html';
const OUT = path.join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });
const report = { pass: [], fail: [] };
const ok = (name, cond, detail) => (cond ? report.pass : report.fail).push(name + (detail ? ` — ${detail}` : ''));

(async () => {
  if (!REMOTE) await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  console.error('QA against', ORIGIN);
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
    // hero team-photo carousel + live badge
    const slides = await page.$$eval('.slide img', imgs => imgs.map(i => ({ w: i.naturalWidth, h: i.naturalHeight, complete: i.complete, src: i.currentSrc.split('/').pop(), alt: i.alt })));
    ok('hero: 2 slides, both photos decoded', slides.length === 2 && slides.every(s => s.complete && s.w > 0 && s.alt.length > 20), JSON.stringify(slides));
    ok('hero: photos are 4:5', slides.every(s => Math.abs(s.w / s.h - 0.8) < 0.01));
    const ratio = await page.evaluate(() => { const r = document.querySelector('.hero-photo').getBoundingClientRect(); return +(r.width / r.height).toFixed(2); });
    ok('hero: photo frame is 4:5', Math.abs(ratio - 0.8) < 0.03, `${ratio}`);
    ok('hero: live badge sits inside photo', await page.evaluate(() => { const p = document.querySelector('.hero-photo').getBoundingClientRect(), b = document.querySelector('.hero-badge').getBoundingClientRect(); return b.left >= p.left && b.right <= p.right && b.bottom <= p.bottom; }));
    ok('hero: caption text', (await page.locator('.hero-cap p').innerText()).trim() === 'Uproot Clean team accepting 1st Place Award at Global Pet 2026 for Pet Tech Innovation');
    ok('hero: counter starts 1 / 2', (await page.locator('#car-idx').innerText()) === '1 / 2');
    await page.click('#car-next');
    await page.waitForFunction(() => { const t = document.getElementById('team-slides'); return Math.abs(t.scrollLeft - t.clientWidth) < 2; }, null, { timeout: 3000 }).catch(() => {});
    const pos2 = await page.evaluate(() => { const t = document.getElementById('team-slides'); return { left: Math.round(t.scrollLeft), w: t.clientWidth }; });
    ok('hero: next → slide 2 in view', Math.abs(pos2.left - pos2.w) < 2 && (await page.locator('#car-idx').innerText()) === '2 / 2', JSON.stringify(pos2));
    await page.click('#car-next');
    await page.waitForFunction(() => document.getElementById('team-slides').scrollLeft < 2, null, { timeout: 3000 }).catch(() => {});
    ok('hero: next wraps back to slide 1', (await page.evaluate(() => document.getElementById('team-slides').scrollLeft)) < 2 && (await page.locator('#car-idx').innerText()) === '1 / 2');
    await page.focus('#team-slides'); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => { const t = document.getElementById('team-slides'); return Math.abs(t.scrollLeft - t.clientWidth) < 2; }, null, { timeout: 3000 }).catch(() => {});
    ok('hero: arrow key advances', (await page.locator('#car-idx').innerText()) === '2 / 2');
    await page.click('#car-prev');
    await page.waitForFunction(() => document.getElementById('team-slides').scrollLeft < 2, null, { timeout: 3000 }).catch(() => {});
    ok('hero: carousel track does not widen the page', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('hero: webp source offered', (await page.locator('.slide source[type="image/webp"]').count()) === 2);
    // round-4 copy checks
    const navLabels = await page.$$eval('.nav-links a', as => as.map(a => a.textContent.trim()));
    ok('nav: 4 links, Title Case, no Fit check', navLabels.join('|') === 'The Company|Why Join|Benefits|How We Hire', navLabels.join('|'));
    ok('company: 10,000+ retail doors shown', (await page.locator('.retailer-bar .doors').innerText()).replace(/\s+/g, ' ').trim() === '10,000+ retail doors');
    ok('why: new headline', (await page.locator('#why h2').innerText()) === 'Own the work that shows up in millions of homes every year.');
    const benefits = await page.$$eval('.benefit h3', hs => hs.map(h => h.textContent.trim()));
    ok('benefits: 6 cards in order', benefits.join('|') === 'Remote by design|Autonomy|Wellness budget|Pet budget|Health, vision & dental insurance|Coaching & learning credits', benefits.join('|'));
    const amounts = await page.$$eval('.benefit p', ps => ps.map(p => p.textContent));
    ok('benefits: budgets state amounts', amounts.some(a => a.includes('$100–300/mo')) && amounts.some(a => a.includes('$40–100/mo')));
    const steps = await page.$$eval('.steps .step', els => els.map(e => ({ n: e.querySelector('.n').textContent.trim(), h: e.querySelector('h3').textContent.trim(), opt: e.classList.contains('step-opt'), pill: e.querySelector('.pill').textContent.trim() })));
    ok('hire: 5 cards incl. 3a Paid Trial Project', steps.map(s => s.n).join() === '1,2,3,3a,4' && steps[3].h === 'Paid Trial Project' && steps[3].opt && /5–10 hrs/.test(steps[3].pill), JSON.stringify(steps.map(s => s.n + ':' + s.h)));
    const stepCols5 = await page.evaluate(() => getComputedStyle(document.querySelector('.steps')).gridTemplateColumns.split(' ').length);
    ok('hire: 5 columns at 1280', stepCols5 === 5, `${stepCols5}`);
    ok('hire: step cards equal height, no text overflow', await page.evaluate(() => { const c = [...document.querySelectorAll('.step')]; const hs = c.map(e => e.getBoundingClientRect().height); return Math.max(...hs) - Math.min(...hs) < 1 && c.every(e => e.scrollHeight <= e.clientHeight + 1); }));
    ok('company: Featured-in removed', (await page.locator('.press, .proof').count()) === 0);
    const aw = await page.$$eval('.award-slide', ls => ls.map(l => ({ cap: [...l.querySelector('figcaption').childNodes].map(n => n.textContent.trim()).filter(Boolean).join(' '), kind: l.querySelector('img.badge') ? 'img' : (l.querySelector('svg.badge') ? 'svg' : 'none'), label: (l.querySelector('.badge').getAttribute('alt') || l.querySelector('.badge').getAttribute('aria-label')), h: l.querySelector('.badge').getBoundingClientRect().height })));
    ok('awards: 4 slides (1 official png + 3 svg)', aw.length === 4 && aw.map(a => a.kind).join() === 'img,svg,svg,svg', aw.map(a => a.kind).join());
    ok('awards: captions', aw.map(a => a.cap).join('|') === 'Global Pet Expo 2024 Pet Tech Innovation|SuperZoo 2024 Innovation Launch Prize|Global Pet Expo 2026 Pet Tech Innovation|SuperZoo 2026 Home & Lifestyle', aw.map(a => a.cap).join('|'));
    ok('awards: badges labelled, 150px tall', aw.every(a => a.label && a.label.length > 20 && Math.abs(a.h - 150) < 1), JSON.stringify(aw.map(a => Math.round(a.h))));
    ok('awards: official 2024 badge decoded', await page.evaluate(() => { const i = document.querySelector('img.badge'); return i.complete && i.naturalWidth === 640; }));
    ok('awards: badge text stays inside its band', await page.evaluate(() => [...document.querySelectorAll('svg.badge text')].every(tx => { const b = tx.getBBox(); const ribbon = /b-r[12]/.test(tx.getAttribute('class')); const lo = ribbon ? 84 : 20, hi = ribbon ? 556 : 620; return b.x >= lo && b.x + b.width <= hi; })));
    ok('awards: strip is compact (< 220px tall at 1280)', await page.evaluate(() => document.querySelector('.awards-strip').getBoundingClientRect().height < 220), await page.evaluate(() => Math.round(document.querySelector('.awards-strip').getBoundingClientRect().height) + 'px'));
    ok('awards: 4 dots, first current', (await page.locator('#aw-dots .dot').count()) === 4 && (await page.locator('#aw-dots .dot').first().getAttribute('aria-current')) === 'true');
    const before = await page.evaluate(() => { const t = document.getElementById('award-slides'); return Math.round(t.scrollLeft / t.clientWidth); });
    await page.click('#aw-next');
    await page.waitForFunction(b => { const t = document.getElementById('award-slides'); return Math.abs(t.scrollLeft - ((b + 1) % 4) * t.clientWidth) < 2; }, before, { timeout: 3000 }).catch(() => {});
    ok('awards: next advances one slide and moves the dot', await page.evaluate(b => { const t = document.getElementById('award-slides'); const want = (b + 1) % 4; return Math.abs(t.scrollLeft - want * t.clientWidth) < 2 && document.querySelectorAll('#aw-dots .dot')[want].getAttribute('aria-current') === 'true'; }, before), `from ${before}`);
    await page.click('#aw-dots .dot:nth-child(4)');
    await page.waitForFunction(() => { const t = document.getElementById('award-slides'); return Math.abs(t.scrollLeft - 3 * t.clientWidth) < 2; }, null, { timeout: 3000 }).catch(() => {});
    ok('awards: dot 4 jumps to slide 4', await page.evaluate(() => { const t = document.getElementById('award-slides'); return Math.abs(t.scrollLeft - 3 * t.clientWidth) < 2; }));
    ok('awards: no console errors after carousel use', consoleErrors.length === 0, consoleErrors.join(' | '));
    // retailer logos
    const logos = await page.$$eval('.retailer-bar .logo-svg', els => els.map(e => ({ name: e.getAttribute('aria-label'), w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
    ok('retailers: 4 logo SVGs with labels', logos.length === 4 && logos.map(l => l.name).join() === 'Amazon,Walmart,Target,Petco', logos.map(l => l.name).join());
    ok('retailers: logos have real size (Target bullseye is square)', logos.every(l => l.w >= 28 && l.h >= 20 && l.h <= 32), JSON.stringify(logos));
    ok('retailers: no leaked svg class rules', await page.evaluate(() => !document.querySelector('.retailer-bar svg style')));
    const stepCols = await page.evaluate(() => getComputedStyle(document.querySelector('.steps')).gridTemplateColumns.split(' ').length);
    ok('desktop: interview steps 5 columns', stepCols === 5, `${stepCols}`);

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
    ok('roles: every listed role links to its local JD page (roles/<slug>.html)',
      hrefs.length > 0 && hrefs.every(h => new RegExp('^' + ORIGIN + '/roles/[a-z0-9-]+\\.html$').test(h.href) && h.t === ''), hrefs.filter(h => !/\/roles\/[a-z0-9-]+\.html$/.test(h.href)).map(h => h.href).join(','));
    const pagesJson = JSON.parse(require('fs').readFileSync(path.resolve(__dirname, '..', 'roles', 'index.json'), 'utf8'));
    ok('roles: index.json covers every role in the live list', hrefs.every(h => Object.values(pagesJson.jobs).some(j => h.href.endsWith(j.page))), `${Object.keys(pagesJson.jobs).length} pages`);
    for (const j of Object.values(pagesJson.jobs)) if (!require('fs').existsSync(path.resolve(__dirname, '..', j.page))) report.fail.push('roles: missing file ' + j.page);

    // homepage: trial roles are tagged in the list and named in the 3a card
    const tagged = await page.$$eval('.role', as => as.filter(a => a.querySelector('.tag-trial')).map(a => a.querySelector('h3').textContent.trim()).sort());
    ok('trial: homepage list tags the two trial roles', tagged.join('|') === 'Finance Manager (CPA Required)|Supply Chain Manager', tagged.join('|'));
    ok('trial: 3a card names them', (await page.locator('#trial-roles').innerText()) === 'Currently required for Finance Manager (CPA Required) and Supply Chain Manager.', await page.locator('#trial-roles').innerText());
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
    ok('mobile: caption + controls visible', await page.locator('.hero-cap p').isVisible() && await page.locator('#car-next').isVisible());
    await page.evaluate(() => { const t = document.getElementById('team-slides'); t.scrollTo({ left: t.clientWidth, behavior: 'auto' }); });
    await page.waitForFunction(() => document.getElementById('car-idx').textContent === '2 / 2', null, { timeout: 2000 }).catch(() => {});
    ok('mobile: swipe (scroll) updates counter', (await page.locator('#car-idx').innerText()) === '2 / 2',
      await page.evaluate(() => { const t = document.getElementById('team-slides'); return `scrollLeft=${t.scrollLeft} clientWidth=${t.clientWidth} scrollWidth=${t.scrollWidth} idx=${document.getElementById('car-idx').textContent}`; }));
    await page.evaluate(() => document.getElementById('team-slides').scrollTo({ left: 0, behavior: 'auto' }));
    await page.waitForTimeout(250);
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

  // ---------- 2b. Role page (JD + apply → Ashby application) ----------
  {
    const fs = require('fs');
    const pagesJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'roles', 'index.json'), 'utf8'));
    const [jobId, meta] = Object.entries(pagesJson.jobs)[0];
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errs = [], consoleErr = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); });
    const apiResp = page.waitForResponse(r => r.url().includes('api.ashbyhq.com'), { timeout: 15000 }).catch(() => null);
    await page.goto(ORIGIN + '/' + meta.page);
    await apiResp; await page.waitForTimeout(400);
    ok('role: title matches Ashby', (await page.locator('h1#role-title').innerText()).trim() === meta.title, await page.locator('h1').innerText());
    ok('role: <title> carries the job title', (await page.title()).startsWith(meta.title));
    const applies = await page.$$eval('a[data-apply], .nav-inner a.btn', as => as.map(a => ({ href: a.href, t: a.target, r: a.rel, txt: a.textContent.trim() })));
    ok('role: apply links top + aside + bottom (4) → Ashby /application with UTM, new tab',
      applies.length === 4 && applies.every(a => a.href === meta.apply && a.t === '_blank' && a.r === 'noopener' && /^Apply now/.test(a.txt)), JSON.stringify(applies.map(a => a.href.split('/').slice(-2).join('/'))));
    ok('role: apply URL is the application form, not the JD', /\/application\?utm_source=uprootclean\.com&utm_medium=careers-page$/.test(meta.apply) && !/\/[0-9a-f-]{36}\?/.test(meta.apply));
    const jd = await page.evaluate(() => { const el = document.getElementById('jd'); return { text: el.innerText.trim().length, h3: el.querySelectorAll('h3').length, li: el.querySelectorAll('li').length, styled: el.querySelectorAll('[style]').length, scripts: el.querySelectorAll('script,iframe').length }; });
    ok('role: JD content present (>1500 chars, headings, bullets)', jd.text > 1500 && jd.h3 >= 3 && jd.li >= 5, JSON.stringify(jd));
    ok('role: JD has no inline styles or scripts', jd.styled === 0 && jd.scripts === 0);
    ok('role: first JD heading is not a duplicate of the title', (await page.evaluate(() => { const h = document.querySelector('#jd h3'); return h ? h.textContent.trim().toLowerCase() : ''; })) !== meta.title.toLowerCase());
    ok('role: closed notice hidden while listed', await page.locator('#role-closed').isHidden());
    ok('role: back link + nav go to careers home', await page.evaluate(() => document.querySelector('.back').getAttribute('href') === '../index.html#roles' && document.querySelector('.logo').getAttribute('href') === '../index.html'));
    ok('role: sidebar sticky; non-trial role shows the 4 core steps', await page.evaluate(() => getComputedStyle(document.querySelector('.role-aside')).position === 'sticky' && document.querySelectorAll('.aside-steps li').length === 4));
    ok('role: Poppins loaded on role page', await page.evaluate(() => document.fonts.check('800 16px Poppins')));
    ok('role: no console/page errors', errs.length === 0 && consoleErr.length === 0, [...errs, ...consoleErr].join(' | '));
    ok('role: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('role: JSON-LD JobPosting present', await page.evaluate(() => { try { const d = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); return d['@type'] === 'JobPosting' && d.directApply === true && /\/application/.test(d.url); } catch (e) { return false; } }));
    // trial-project roles (scripts/roles.config.json) vs the rest
    const trialIds = Object.entries(pagesJson.jobs).filter(([, v]) => v.trial).map(([k, v]) => v);
    ok('trial: config marks exactly Finance Manager + Supply Chain Manager', trialIds.map(v => v.title).sort().join('|') === 'Finance Manager (CPA Required)|Supply Chain Manager', trialIds.map(v => v.title).join('|'));
    ok('trial: this page (no trial) hides step 3a and the pill', await page.evaluate(() => !document.querySelector('.aside-steps li.opt') && !document.querySelector('.trial-pill') && document.querySelectorAll('.aside-steps li').length === 4));
    const tp = await ctx.newPage();
    await tp.goto(ORIGIN + '/' + trialIds[0].page); await tp.waitForTimeout(300);
    ok('trial: Finance/Supply page shows 3a in the interview loop + At-a-glance row, no pill under title', await tp.evaluate(() => {
      const opt = document.querySelector('.aside-steps li.opt');
      const facts = [...document.querySelectorAll('.facts dt')].map(d => d.textContent.trim());
      return !document.querySelector('.trial-pill') && opt && /5–10 hrs/.test(opt.textContent) && document.querySelectorAll('.aside-steps li').length === 5 && facts.includes('Trial project');
    }));
    await tp.screenshot({ path: path.join(OUT, 'role-trial-desktop.png') });
    await tp.close();
    await page.screenshot({ path: path.join(OUT, 'role-desktop.png') });
    await page.locator('.role-cta').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(OUT, 'role-desktop-bottom.png') });
    // closed-role path: API says the job is gone
    const p2 = await ctx.newPage();
    await p2.route('**/api.ashbyhq.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ jobs: [] }) }));
    await p2.goto(ORIGIN + '/' + meta.page); await p2.waitForTimeout(500);
    ok('role: closed notice shown + apply disabled when Ashby no longer lists it', await p2.evaluate(() => !document.getElementById('role-closed').hidden && [...document.querySelectorAll('[data-apply]')].every(a => a.getAttribute('aria-disabled') === 'true' && !a.hasAttribute('href'))));
    await ctx.close();
    // mobile
    const m = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const mp = await m.newPage(); await mp.goto(ORIGIN + '/' + meta.page); await mp.waitForTimeout(400);
    ok('role mobile: no horizontal overflow', await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('role mobile: single column, aside below JD', await mp.evaluate(() => getComputedStyle(document.querySelector('.role-grid')).gridTemplateColumns.split(' ').length === 1 && document.querySelector('.role-aside').getBoundingClientRect().top > document.querySelector('#jd').getBoundingClientRect().top));
    await mp.screenshot({ path: path.join(OUT, 'role-mobile.png') });
    await m.close();
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
  if (!REMOTE) server.close();
  console.log(JSON.stringify(report, null, 2));
  console.log(`\n${report.pass.length} passed, ${report.fail.length} failed`);
  process.exit(report.fail.length ? 1 : 0);
})().catch(e => { console.error('QA crashed:', e); process.exit(2); });
