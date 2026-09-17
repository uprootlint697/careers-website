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

Hero (with at-a-glance panel) · The company · Why join · Benefits · How we hire (4 steps,
1–2 weeks) · Fit check · Open roles (live) · Stay in the loop (LinkedIn + job board) · Footer.

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

Verified with Playwright (Chromium) on 2026-09-17 — desktop 1280 and mobile 375: live API
render, filters, link integrity, in-page anchors, skip link, no console errors, no horizontal
overflow, API-down / API-empty / XSS paths. See the commit message for the run summary.
