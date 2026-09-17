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

Hero (team photo + live open-roles badge) · The company · Why join · Benefits · How we hire
(4 steps, 1–2 weeks) · Fit check · Open roles (live) · Stay in the loop (LinkedIn + job board) · Footer.

## Swapping in the team photo

The hero's right column is a `.hero-photo` slot holding a brand-gradient **placeholder** (an inline
SVG data URI) until the real team image exists. To replace it:

1. Export the photo as **4:5 portrait, ≥1400 px wide** (1400×1750 is the slot's intrinsic size).
2. In `index.html`, find the `<!-- Team photo: swap src ... -->` comment and change the `<img>`'s
   `src` to the image URL. Keep `width="1400" height="1750"` so layout doesn't shift while loading.
3. Set a real `alt` (e.g. `alt="The Uproot Clean team on a video call"`). It's `alt=""` now because
   the placeholder is decorative.

The "Open roles right now" badge overlays the bottom of the photo and keeps working unchanged.

## Retailer logos

"Where we sell" shows Amazon, Walmart, Target and Petco as **inline SVG wordmarks** (official
vector logos from Wikimedia Commons, cleaned: no `<style>` blocks, no stray ids, `viewBox` set,
`role="img"` + `aria-label` on each). They are used nominatively to state where the products are
sold; each mark is its owner's trademark. Sizing is per-logo (`.logo-amazon`, `.logo-walmart`,
`.logo-target`, `.logo-petco`) so the optical weights match at ~24–30 px tall.

## Hosting notes

- **Canonical URL is not set.** Add `<link rel="canonical">` once the final path is known
  (e.g. `https://uprootclean.com/pages/careers` if it lives as a Shopify page, or a subdomain).
- `og:image` reuses the storefront's existing OG image on `uprootclean.com/cdn/...`. Swap for a
  careers-specific image when one exists.
- If hosted as a Shopify page, the inline `<style>` and `<script>` need to be allowed in the
  page template; nothing else changes.

## Content still to confirm (from the original hiring spec)

These were carried from the draft's source boards and are published as written. Verify or
strike before go-live:

- **5M+ customers served** (stat card)
- Benefits copy: PTO + flex days, performance bonus, health coverage, wellness & pet support,
  coaching & learning credits — amounts are intentionally not stated
- Team locations: USA, Canada, Argentina, Brazil, Lithuania, India, Pakistan, Philippines (8)
- Retail partners: Amazon, Walmart, Target, Petco

## QA

```bash
npm i && npm run qa
```

Playwright is pinned to **exactly 1.55.0** (matches the Chromium build already cached on this
machine; `^` ranges drift to newer Playwright releases that demand a browser download).
Screenshots land in `qa/screenshots/` (git-ignored).

Checks (40): desktop 1280 + mobile 375, live Ashby render, hero count = list count, department
filters, link integrity (Ashby URL + UTM + `target=_blank rel=noopener`), in-page anchors, skip
link, Poppins loaded, no console errors, no horizontal overflow, hero photo slot decodes and is 4:5,
badge sits inside the photo, 4 labelled retailer logos with no leaked CSS, API-down / API-empty /
hostile-title paths. Last run 2026-09-17: all green.
