# Uproot Clean — Careers Website

Careers page for [Uproot Clean](https://uprootclean.com). Destined to live on `uprootclean.com`.

## What it is

`index.html` — the careers home, one self-contained page. Inline CSS, Poppins embedded as data URIs (no third-party
font request), a 1.4 KB inline favicon, and one small script. No build step, no dependencies.

```bash
open index.html
```

## Live roles from Ashby

Open roles are **not hardcoded**. On load the homepage calls Ashby's public job-board API

```
GET https://api.ashbyhq.com/posting-api/job-board/uprootclean
```

(CORS `*`, no auth) and renders every listed posting with its department, location, and
employment type. Department filter chips are generated from the data. The hero badge shows the
live count.

### Role pages (`roles/<slug>.html`)

Each role has its own page with the full job description **on the site**, and every "Apply now"
button (nav, hero, sidebar, bottom CTA) goes **straight to the Ashby application form**
(`…/<job-id>/application?utm_source=uprootclean.com&utm_medium=careers-page`) — not the Ashby JD.

```bash
npm run build:roles     # regenerate roles/*.html + roles/index.json from Ashby
```

`scripts/build-roles.mjs` fetches the API, cleans each `descriptionHtml` (strips inline styles,
scripts and wrapper divs; promotes bold-only paragraphs to headings; drops a leading heading that
just repeats the title), and renders it into a template that reuses `index.html`'s `<style>`
(fonts included) and header. It also writes `roles/index.json` (job id → page) and deletes pages
for roles that are no longer listed. Each page carries a `JobPosting` JSON-LD block with
`directApply: true`.

Keeping it fresh, two layers:

1. The homepage list reads `roles/index.json` and links to the local page when one exists;
   a brand-new posting that hasn't been built yet links straight to its Ashby application form,
   so nothing 404s.
2. Every role page re-checks Ashby on load: if the description changed it re-renders from the
   API (sanitised client-side); if the role is no longer listed it shows "This role has closed"
   and disables the Apply buttons.

**Per-role overrides** live in `scripts/roles.config.json`. `trialProject` lists the roles (by exact
title or Ashby job id) that include the paid trial project (step 3a). For those roles the page shows a
"paid trial project" pill under the title, a *Trial project* row in At a glance, and 3a in the
sidebar steps; other roles show a 4-step sidebar with no 3a. The homepage tags them "Paid trial
project" in the list and names them in the 3a card. Currently: Finance Manager (CPA Required),
Supply Chain Manager.

Run `npm run build:roles` whenever roles are added or edited in Ashby, or the config changes (or on
a schedule).

Fallbacks on the homepage, all tested:

| Condition | Behaviour |
|---|---|
| API unreachable / non-200 / >9 s | "We couldn't load the list just now" + link to `jobs.ashbyhq.com/uprootclean`; hero count shows `—` |
| API returns zero jobs | "No open roles right now" + link to the stay-in-the-loop section; count `0` |
| JavaScript disabled | `<noscript>` message linking to the Ashby board |
| Hostile data in a title/department | HTML-escaped before insertion |

To point at a different board, change `BOARD` at the top of the script.

## Sections

Hero (2-photo carousel + caption + live open-roles badge) · The company · Why join · Benefits · How we hire
(4 steps + paid trial project 3a for Finance Manager and Supply Chain Manager, 1–2 weeks) · Fit check · Open roles (live) · Stay in the loop (LinkedIn + job board) · Footer.

## Hero photo carousel

The hero's right column is a two-photo carousel (`#team-carousel`) of the team accepting the
1st-place Pet Tech award at Global Pet Expo 2026, with the caption under it and the live
"Open roles right now" badge overlaid. Photos live in `assets/`:

| File | Use |
|---|---|
| `team-{1,2}-1400.webp` / `.jpg` | desktop (≥761 px), 1400×1750 |
| `team-{1,2}-800.webp` / `.jpg` | phones, 800×1000 |

`<picture>` serves WebP with JPEG fallback; `srcset`/`sizes` pick the width. Every image has a
descriptive `alt`. The originals (4000×5000) are not in the repo.

How it works (shared `carousel()` helper, also used for the awards strip): a horizontal `scroll-snap` track, so touch swipe is native. Prev/next buttons and
←/→ keys (when the track is focused) call `scrollTo`; a `1 / 2` counter follows the scroll
position. Autoplay advances every 6 s and stops permanently on hover, focus, touch or click, and
is disabled under `prefers-reduced-motion`. No library.

**To add or replace a photo:** export 4:5 at 1400 and 800 wide (WebP + JPEG), drop into `assets/`,
copy one `<div class="slide">` block in `index.html` and update the paths and `alt`. The counter
and controls pick up the new count automatically.

## Award badges

"Award-winning" in The Company is a compact strip (`.awards-strip`): copy + controls on the left, a
one-badge-at-a-time carousel on the right (same `carousel()` helper as the hero; autoplays every
3.5 s, dots + arrows, stops on interaction). Each slide sits on a brand wash (blush / periwinkle /
mint / butter) and every badge is rendered in deep teal (`--uproot-deep`):

| Badge | Source | Fact basis |
|---|---|---|
| Global Pet Expo 2024 · Pet Tech Innovation | **Official** — `assets/award-gpe-2024.png`, the file already used on uprootclean.com, recoloured black → deep teal (alpha preserved) | Best in Show, New Products Showcase, Apr 2024 |
| SuperZoo 2024 · Innovation Launch Prize | Recreated inline SVG | 1st Place Purina Petcare Innovation Launch Prize, Aug 2024 (NPS entry was 1st runner-up) |
| Global Pet Expo 2026 · Pet Tech Innovation | Recreated inline SVG | Best in Show, Laundry Cycle Pro, Mar 2026 |
| SuperZoo 2026 · Home & Lifestyle | Recreated inline SVG | 1st Place Best New Product, Washing Machine Cleaner Pro, Aug 2026 |

The three recreations copy the official badge's grammar (show name / 1st Place disc / category /
ribbon) in Poppins so the set reads as one. Official winner badges are distributed to exhibitors via
the Global Pet Expo and WPA (SuperZoo) exhibitor hubs and are not publicly downloadable — when you
have them, drop the PNGs into `assets/` and replace the corresponding `<svg class="badge">` with an
`<img class="badge">` like the 2024 one.

## Retailer logos

"Where we sell" shows Amazon, Walmart, Target and Petco as **inline SVG wordmarks** (official
vector logos from Wikimedia Commons, cleaned: no `<style>` blocks, no stray ids, `viewBox` set,
`role="img"` + `aria-label` on each). They are used nominatively to state where the products are
sold; each mark is its owner's trademark. Sizing is per-logo (`.logo-amazon`, `.logo-walmart`,
`.logo-target`, `.logo-petco`) so the optical weights match at ~24–30 px tall.

## Hosting — GitHub Pages at careers.uprootclean.com

- **Repo:** `github.com/uprootlint697/careers-website` (public — GitHub Pages on a free account
  requires it; the site is public anyway and the repo holds no secrets).
- **Deploy:** `.github/workflows/deploy.yml` runs on every push to `main`, **every 6 hours**, and
  on demand (*Actions → Build & deploy → Run workflow*). It regenerates the role pages from Ashby
  (`node scripts/build-roles.mjs`), assembles `_site/`, and publishes with `actions/deploy-pages`.
  So new/closed roles in Ashby reach the live site within ~6 h with nobody touching anything.
- **Domain:** `CNAME` = `careers.uprootclean.com`. DNS (Namecheap) needs one record:
  `careers  CNAME  uprootlint697.github.io`. GitHub provisions the TLS cert automatically once the
  record resolves; then enable *Enforce HTTPS* in repo Settings → Pages (or via the API).
- **Until DNS is in place** the site is reachable at `https://uprootlint697.github.io/careers-website/`.
  All links are relative, so it works at either address.
- **Storefront hookups (Shopify admin, one-time):** add a URL redirect `/careers` →
  `https://careers.uprootclean.com`, and change the footer "Careers" link (currently
  `jobs.ashbyhq.com/uprootclean`) to `https://careers.uprootclean.com`.
- `uprootclean.com/careers` as a true path isn't possible: Shopify owns the apex and can't proxy a
  path to another host. The subdomain + redirect is the standard pattern.
- **Canonical URLs** are set on `index.html` and every role page (`https://careers.uprootclean.com/...`);
  `sitemap.xml` is generated by the build and referenced from `robots.txt`.
- **Test the deployed site:** `QA_ORIGIN=https://careers.uprootclean.com npm run qa`.

## Content status

Confirmed by Mehul (2026-09-17): retail footprint **10,000+ doors**; awards — 1st Place Global Pet
Expo 2024 & 2026, 1st Place SuperZoo 2024 & 2026 (press list was added then removed for space); benefits — Autonomy,
Wellness budget **$100–300/mo**, Pet budget **$40–100/mo**, Health/vision/dental insurance,
Coaching & learning credits, Remote by design.

Still carried from the original hiring spec, not yet confirmed:

- **5M+ customers served** (stat card)
- Team locations: USA, Canada, Argentina, Brazil, Lithuania, India, Pakistan, Philippines (8)
- "Paid time off plus flex days" and "A learning budget you direct" bullets in the *Why Join*
  cards (PTO was dropped from the Benefits grid; the bullet remains in Why Join)

## QA

```bash
npm i && npm run qa
```

Playwright is pinned to **exactly 1.55.0** (matches the Chromium build already cached on this
machine; `^` ranges drift to newer Playwright releases that demand a browser download).
Screenshots land in `qa/screenshots/` (git-ignored).

Checks (69): desktop 1280 + mobile 375, live Ashby render, hero count = list count, department
filters, link integrity (Ashby URL + UTM + `target=_blank rel=noopener`), in-page anchors, skip
link, Poppins loaded, no console errors, no horizontal overflow, carousel (both photos decode and
are 4:5, frame is 4:5, next/prev/wrap/arrow-key/swipe all update the counter, WebP offered, track
doesn't widen the page, caption text exact), badge inside the photo, 4 labelled retailer logos with
no leaked CSS, API-down / API-empty / hostile-title paths, and round-4 copy (nav labels, 10,000+ doors, Why Join headline, six benefit
cards with amounts), interview steps (1, 2, 3, 3a, 4; 3a flagged as select-roles-only; 5-up grid at 1280;
equal card heights, no overflow), award carousel (Featured-in gone; 1 official + 3 SVG badges, labelled, text inside its band, strip
< 220 px tall, 4 dots, next/dot navigation). Last run 2026-09-17: all green.
