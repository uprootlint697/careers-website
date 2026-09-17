# Uproot Clean — Careers Website

Careers page for [Uproot Clean](https://uprootclean.com). Destined to live on `uprootclean.com`.

## What it is

`index.html` — one self-contained page. Inline CSS, Poppins embedded as data URIs (no third-party
font request), a 1.4 KB inline favicon, and one small script. No build step, no dependencies.

```bash
open index.html
```

## Live roles from Ashby

Open roles are **not hardcoded**. On load the page calls Ashby's public job-board API

```
GET https://api.ashbyhq.com/posting-api/job-board/uprootclean
```

(CORS `*`, no auth) and renders every listed posting with its department, location, and
employment type. Department filter chips are generated from the data. Each role links to its
Ashby posting with `utm_source=uprootclean.com&utm_medium=careers-page`. The hero tile
"Open roles right now" shows the live count.

Fallbacks, all tested:

| Condition | Behaviour |
|---|---|
| API unreachable / non-200 / >9 s | "We couldn't load the list just now" + link to `jobs.ashbyhq.com/uprootclean`; hero count shows `—` |
| API returns zero jobs | "No open roles right now" + link to the stay-in-the-loop section; count `0` |
| JavaScript disabled | `<noscript>` message linking to the Ashby board |
| Hostile data in a title/department | HTML-escaped before insertion |

To point at a different board, change `BOARD` at the top of the script.

## Sections

Hero (2-photo carousel + caption + live open-roles badge) · The company · Why join · Benefits · How we hire
(4 steps, 1–2 weeks) · Fit check · Open roles (live) · Stay in the loop (LinkedIn + job board) · Footer.

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

How it works: a horizontal `scroll-snap` track, so touch swipe is native. Prev/next buttons and
←/→ keys (when the track is focused) call `scrollTo`; a `1 / 2` counter follows the scroll
position. Autoplay advances every 6 s and stops permanently on hover, focus, touch or click, and
is disabled under `prefers-reduced-motion`. No library.

**To add or replace a photo:** export 4:5 at 1400 and 800 wide (WebP + JPEG), drop into `assets/`,
copy one `<div class="slide">` block in `index.html` and update the paths and `alt`. The counter
and controls pick up the new count automatically.

## Retailer logos

"Where we sell" shows Amazon, Walmart, Target and Petco as **inline SVG wordmarks** (official
vector logos from Wikimedia Commons, cleaned: no `<style>` blocks, no stray ids, `viewBox` set,
`role="img"` + `aria-label` on each). They are used nominatively to state where the products are
sold; each mark is its owner's trademark. Sizing is per-logo (`.logo-amazon`, `.logo-walmart`,
`.logo-target`, `.logo-petco`) so the optical weights match at ~24–30 px tall.

## Hosting notes

- **Canonical URL is not set.** Add `<link rel="canonical">` once the final path is known
  (e.g. `https://uprootclean.com/pages/careers` if it lives as a Shopify page, or a subdomain).
- Photos are referenced as relative `assets/...` paths. If the page is pasted into a Shopify page
  template rather than deployed as files, upload the eight images to Shopify Files and swap the
  paths for their CDN URLs.
- `og:image` reuses the storefront's existing OG image on `uprootclean.com/cdn/...`. Swap for a
  careers-specific image when one exists.
- If hosted as a Shopify page, the inline `<style>` and `<script>` need to be allowed in the
  page template; nothing else changes.

## Content status

Confirmed by Mehul (2026-09-17): retail footprint **10,000+ doors**; benefits — Autonomy,
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

Checks (55): desktop 1280 + mobile 375, live Ashby render, hero count = list count, department
filters, link integrity (Ashby URL + UTM + `target=_blank rel=noopener`), in-page anchors, skip
link, Poppins loaded, no console errors, no horizontal overflow, carousel (both photos decode and
are 4:5, frame is 4:5, next/prev/wrap/arrow-key/swipe all update the counter, WebP offered, track
doesn't widen the page, caption text exact), badge inside the photo, 4 labelled retailer logos with
no leaked CSS, API-down / API-empty / hostile-title paths, and round-4 copy (nav labels, 10,000+ doors, Why Join headline, six benefit
cards with amounts). Last run 2026-09-17: all green.
