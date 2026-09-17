#!/usr/bin/env node
// Build one static page per open role from Ashby's public job-board API.
//   npm run build:roles
// Writes roles/<slug>.html and roles/index.json (job id -> page), removes pages
// for roles that are no longer listed. Each page reuses index.html's <style>
// (fonts included) so the design stays in one place, and re-checks Ashby on
// load so a page never shows a stale or closed posting.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BOARD = 'uprootclean';
const API = `https://api.ashbyhq.com/posting-api/job-board/${BOARD}`;
const BOARD_URL = `https://jobs.ashbyhq.com/${BOARD}`;
const UTM = 'utm_source=uprootclean.com&utm_medium=careers-page';
const OUT = resolve(ROOT, 'roles');
const SITE = 'https://careers.uprootclean.com';

const CONFIG = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'roles.config.json'), 'utf8'));
const norm = s => String(s || '').trim().toLowerCase();
const hasTrial = j => (CONFIG.trialProject || []).some(k => norm(k) === norm(j.id) || norm(k) === norm(j.title));
const compOf = j => { const m = CONFIG.compensation || {}; const k = Object.keys(m).find(k => norm(k) === norm(j.id) || norm(k) === norm(j.title)); return k ? m[k] : null; };

const index = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const style = index.match(/<style>[\s\S]*?<\/style>/)[0];
const favicon = index.match(/<link rel="icon"[^>]*>/)[0];
const pixel = index.match(/<!-- Meta Pixel Code -->[\s\S]*?<!-- End Meta Pixel Code -->\n/)[0];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
const withUtm = u => u + (u.includes('?') ? '&' : '?') + UTM;
const TYPES = { FullTime: 'Full-time', PartTime: 'Part-time', Intern: 'Internship', Contract: 'Contract', Temporary: 'Temporary' };
const fmtDate = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); // UTC so local and CI builds agree

// Ashby descriptions use p/strong/h2/h3/ul/li/div/br/em/a with inline styles.
// Keep the structure, drop the styling, promote "<p><strong>Heading</strong></p>" to h3.
function cleanJd(html, title) {
  let h = html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/\s(class|id)="[^"]*"/gi, '')
    .replace(/href="\s*javascript:[^"]*"/gi, 'href="#"')
    .replace(/<\/?div>/gi, '')
    .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '')
    .replace(/<p><strong>([^<]{2,80})<\/strong><\/p>/g, (m, t) => /[.!?]$/.test(t.trim()) ? m : `<h3>${t}</h3>`)
    .replace(/<h[12]>/g, '<h3>').replace(/<\/h[12]>/g, '</h3>')
    .replace(/<a /g, '<a rel="noopener" target="_blank" ');
  // drop a leading heading that just repeats the job title
  h = h.replace(new RegExp(`^\\s*<h3>\\s*${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/h3>`, 'i'), '');
  return h.trim();
}

const page = (j) => {
  const slug = slugify(j.title);
  const type = TYPES[j.employmentType] || '';
  const bits = [j.isRemote ? 'Remote' : '', j.location, type].filter(Boolean);
  const apply = withUtm(j.applyUrl || `${j.jobUrl}/application`);
  const dept = j.department || 'Other', team = j.team && j.team !== j.department ? j.team : '';
  const posted = j.publishedAt ? fmtDate(j.publishedAt) : '';
  const desc = (j.descriptionPlain || '').replace(/\s+/g, ' ').trim().slice(0, 155).replace(/\s\S*$/, '') + '…';
  const jd = cleanJd(j.descriptionHtml || '', j.title);
  const trial = hasTrial(j);
  const comp = compOf(j);
  const ld = {
    '@context': 'https://schema.org', '@type': 'JobPosting',
    title: j.title.trim(), description: j.descriptionPlain || '', datePosted: j.publishedAt,
    employmentType: (j.employmentType || '').replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase(),
    hiringOrganization: { '@type': 'Organization', name: 'Uproot Clean', sameAs: 'https://uprootclean.com' },
    jobLocationType: j.isRemote ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: j.location ? { '@type': 'Country', name: j.location } : undefined,
    directApply: true, url: apply,
    baseSalary: comp && comp.min ? { '@type': 'MonetaryAmount', currency: comp.currency || 'USD', value: { '@type': 'QuantitativeValue', minValue: comp.min, maxValue: comp.max || comp.min, unitText: comp.unit || 'YEAR' } } : undefined,
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(j.title.trim())} — Careers at Uproot Clean</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${SITE}/roles/${slug}.html" />
<meta name="theme-color" content="#004651" />
${favicon}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Uproot Clean" />
<meta property="og:url" content="${SITE}/roles/${slug}.html" />
<meta property="og:title" content="${esc(j.title.trim())} — Careers at Uproot Clean" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="https://uprootclean.com/cdn/shop/files/cleaner-ecom-Max-Quality.jpg?crop=center&height=630&v=1642553668&width=1200" />
<meta name="twitter:card" content="summary_large_image" />
${pixel}<link rel="preconnect" href="https://api.ashbyhq.com" crossorigin />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
${style}
</head>
<body data-job-id="${esc(j.id)}" data-job-title="${esc(j.title.trim())}" data-job-dept="${esc(dept)}">
  <a class="skip-link" href="#main">Skip to content</a>

  <div class="banner">
    <span class="spark">✦</span> Build your next chapter with Uproot Clean — fully remote.
    <a href="../index.html#roles">See all open roles</a>
  </div>

  <header class="nav">
    <div class="wrap nav-inner">
      <a class="logo" href="../index.html">UPROOT <span class="spark">✦</span> CLEAN</a>
      <nav class="nav-links" aria-label="Sections">
        <a href="../index.html#culture">The Company</a>
        <a href="../index.html#why">Why Join</a>
        <a href="../index.html#benefits">Benefits</a>
        <a href="../index.html#hire">How We Hire</a>
      </nav>
      <a class="btn btn-primary" href="${apply}" target="_blank" rel="noopener" data-apply>Apply now <span class="arw" aria-hidden="true">→</span></a>
    </div>
  </header>

  <main id="main">
    <section class="role-hero">
      <div class="wrap">
        <a class="back" href="../index.html#roles"><span aria-hidden="true">←</span> All open roles</a>
        <p class="section-kicker">${esc(dept)}${team ? ` · ${esc(team)}` : ''}</p>
        <h1 id="role-title">${esc(j.title.trim())}</h1>
        <p class="meta-row role-meta">${bits.map(esc).join(' · ')}${posted ? ` · Posted ${esc(posted)}` : ''}</p>
        <div class="hero-cta">
          <a class="btn btn-primary btn-lg" href="${apply}" target="_blank" rel="noopener" data-apply>Apply now <span class="arw" aria-hidden="true">→</span></a>
          <a class="btn btn-ghost" href="../index.html#fit">Not sure? Check the fit</a>
        </div>
        <p class="role-closed" id="role-closed" hidden>This role has closed. <a href="../index.html#roles">See what&rsquo;s open now.</a></p>
      </div>
    </section>

    <section class="band-white role-body">
      <div class="wrap role-grid">
        <article class="jd" id="jd">
${jd}
        </article>
        <aside class="role-aside">
          <div class="aside-card">
            <h2 class="aside-h">At a glance</h2>
            <dl class="facts">
              <dt>Department</dt><dd>${esc(dept)}</dd>
              ${team ? `<dt>Team</dt><dd>${esc(team)}</dd>` : ''}
              <dt>Location</dt><dd>${esc(j.isRemote ? `Remote · ${j.location || ''}`.replace(/ · $/, '') : (j.location || ''))}</dd>
              ${type ? `<dt>Type</dt><dd>${esc(type)}</dd>` : ''}
              ${comp ? `<dt>Compensation</dt><dd class="comp">${esc(comp.text)}</dd>` : ''}
              ${posted ? `<dt>Posted</dt><dd>${esc(posted)}</dd>` : ''}
              ${trial ? `<dt>Trial project</dt><dd>Paid · 5–10 hrs</dd>` : ''}
            </dl>
            <a class="btn btn-primary btn-block" href="${apply}" target="_blank" rel="noopener" data-apply>Apply now <span class="arw" aria-hidden="true">→</span></a>
            <p class="fine-print">Applications go through Ashby, our hiring platform. Takes about five minutes.</p>
          </div>
          <div class="aside-card aside-steps">
            <h2 class="aside-h">How we hire</h2>
            <ol>
              <li>Screening call <span>15 min</span></li>
              <li>Portfolio showcase <span>5 min</span></li>
              <li>Team manager interview <span>45 min</span></li>
              ${trial ? `<li class="opt">Paid trial project <span>5–10 hrs · paid</span></li>` : ''}
              <li>Executive interview <span>45 min</span></li>
            </ol>
            <a class="more" href="../index.html#hire">The full process →</a>
          </div>
        </aside>
      </div>
    </section>

    <section class="band-butter role-cta">
      <div class="wrap">
        <div class="cta-card">
          <div>
            <h2>Ready to apply?</h2>
            <p>You&rsquo;ll be taken to Ashby to submit your application for <b>${esc(j.title.trim())}</b>.</p>
          </div>
          <div class="wait-actions">
            <a class="btn btn-primary btn-lg" href="${apply}" target="_blank" rel="noopener" data-apply>Apply now <span class="arw" aria-hidden="true">→</span></a>
            <a class="btn btn-ghost" href="../index.html#roles">All open roles</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="wrap">
    <div>© <span id="year">${new Date().getFullYear()}</span> Uproot Clean. All rights reserved.</div>
    <nav aria-label="Footer">
      <a href="https://uprootclean.com">Shop uprootclean.com</a>
      <a href="https://uprootclean.com/policies/privacy-policy">Privacy policy</a>
      <a href="https://uprootclean.com/pages/accessibility">Accessibility</a>
      <a href="../index.html">Careers home</a>
    </nav>
  </footer>

  <script>
  (function () {
    'use strict';
    document.getElementById('year').textContent = String(new Date().getFullYear());

    // ---- Meta Pixel: Lead when someone clicks Apply now (links open in a new tab, so the hit isn't cut off) ----
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-apply]');
      if (!a || !a.getAttribute('href') || a.getAttribute('aria-disabled') === 'true' || typeof window.fbq !== 'function') return;
      var b = document.body;
      window.fbq('track', 'Lead', {
        content_name: a.getAttribute('data-job-title') || b.getAttribute('data-job-title') || document.title,
        content_category: a.getAttribute('data-job-dept') || b.getAttribute('data-job-dept') || 'Careers',
        content_ids: [a.getAttribute('data-job-id') || b.getAttribute('data-job-id') || ''],
        content_type: 'job'
      });
    }, true);
    // Re-check Ashby: refresh the description if it changed, or mark the role closed.
    var id = document.body.getAttribute('data-job-id');
    if (!window.fetch || !id) return;
    var ALLOW = { P: 1, STRONG: 1, EM: 1, B: 1, I: 1, UL: 1, OL: 1, LI: 1, H2: 1, H3: 1, H4: 1, BR: 1, A: 1 };
    function clean(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType !== 1) return;
        clean(c);
        if (!ALLOW[c.tagName]) { while (c.firstChild) node.insertBefore(c.firstChild, c); node.removeChild(c); return; }
        Array.prototype.slice.call(c.attributes).forEach(function (a) { if (!(c.tagName === 'A' && a.name === 'href' && /^https?:/i.test(a.value))) c.removeAttribute(a.name); });
        if (c.tagName === 'A') { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
        if (c.tagName === 'H2' || c.tagName === 'H4') { var h = document.createElement('h3'); while (c.firstChild) h.appendChild(c.firstChild); node.replaceChild(h, c); }
      });
    }
    fetch('${API}').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      var job = (d.jobs || []).filter(function (x) { return x.id === id && x.isListed !== false; })[0];
      if (!job) {
        document.getElementById('role-closed').hidden = false;
        Array.prototype.forEach.call(document.querySelectorAll('[data-apply]'), function (a) { a.setAttribute('aria-disabled', 'true'); a.classList.add('is-disabled'); a.removeAttribute('href'); });
        return;
      }
      var built = document.getElementById('jd').getAttribute('data-hash');
      var fresh = String((job.descriptionHtml || '').length) + ':' + (job.descriptionHtml || '').slice(0, 64);
      if (built === fresh) return;
      var doc = new DOMParser().parseFromString(job.descriptionHtml || '', 'text/html');
      clean(doc.body);
      Array.prototype.forEach.call(doc.body.querySelectorAll('p'), function (p) { if (!p.textContent.trim() && !p.querySelector('br')) p.remove(); });
      Array.prototype.forEach.call(doc.body.querySelectorAll('p'), function (p) {
        if (p.children.length === 1 && p.children[0].tagName === 'STRONG' && p.textContent.trim() === p.children[0].textContent.trim() && p.textContent.trim().length < 80 && !/[.!?]$/.test(p.textContent.trim())) {
          var h = document.createElement('h3'); h.textContent = p.textContent.trim(); p.replaceWith(h);
        }
      });
      var first = doc.body.firstElementChild;
      if (first && first.tagName === 'H3' && first.textContent.trim().toLowerCase() === job.title.trim().toLowerCase()) first.remove();
      document.getElementById('jd').innerHTML = doc.body.innerHTML;
      document.getElementById('role-title').textContent = job.title.trim();
    }).catch(function () {});
  })();
  </script>
</body>
</html>
`;
};

const res = await fetch(`${API}?includeCompensation=true`);
if (!res.ok) throw new Error(`Ashby API ${res.status}`);
const { jobs } = await res.json();
const listed = jobs.filter(j => j.isListed !== false);
mkdirSync(OUT, { recursive: true });

const map = {};
const keep = new Set(['index.json']);
for (const j of listed) {
  const slug = slugify(j.title);
  const file = `${slug}.html`;
  let html = page(j);
  const hash = String((j.descriptionHtml || '').length) + ':' + (j.descriptionHtml || '').slice(0, 64);
  html = html.replace('<article class="jd" id="jd">', `<article class="jd" id="jd" data-hash="${esc(hash)}">`);
  writeFileSync(resolve(OUT, file), html);
  map[j.id] = { page: `roles/${file}`, title: j.title.trim(), apply: withUtm(j.applyUrl || `${j.jobUrl}/application`), trial: hasTrial(j) };
  keep.add(file);
  console.log(`✓ roles/${file}  (${(j.descriptionHtml || '').length} chars)${hasTrial(j) ? '  · trial project' : ''}`);
}
for (const f of readdirSync(OUT)) if (!keep.has(f)) { unlinkSync(resolve(OUT, f)); console.log(`✗ removed stale roles/${f}`); }
writeFileSync(resolve(OUT, 'index.json'), JSON.stringify({ builtAt: new Date().toISOString(), board: BOARD_URL, jobs: map }, null, 2));
const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/`, ...Object.values(map).map(m => `${SITE}/${m.page}`)];
writeFileSync(resolve(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
console.log(`sitemap.xml: ${urls.length} urls`);
console.log(`\n${listed.length} role pages, roles/index.json written`);
