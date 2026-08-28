# Independent verification — FAIL

**Tested candidate:** `0671efbcc4a332e98d4939a8fa558a3cc7974900` (`0671efb`, clean detached checkout)
**Live URL:** https://raw-sidecar-sanity.sociobot.in/
**Verified:** 2026-08-28 UTC

## Decision

**FAIL.** The production site is the tested candidate, but it fails the required accessibility gate after the core, real-world inspection flow is used. It also has keyboard skip-link and production caching defects. No product source was modified during verification.

## Blocking defects

### P1 — serious colour-contrast failure in a core report state

1. Load the checker, then select **Try a labelled sample**.
2. Run axe-core on the resulting report at both 1440 × 1100 and 390 × 844.
3. axe reports one **serious** `color-contrast` violation:
   - target: `.report-top > div:nth-child(1) > .eyebrow`
   - element: `Inspection <id>`
   - foreground `#f1b67d` on report background `#fffaf0`
   - measured contrast **1.72:1**, required **4.5:1** for 12 px bold text.

The repository axe test only scans the empty state, so it misses this report-state failure. This violates the stated zero serious/critical axe requirement and WCAG AA contrast acceptance gate.

### P2 — keyboard skip link does not move focus into main content

At the first Tab stop, `Skip to checker` is visible. Activating it with Enter targets `#main`, but `<main id="main">` is not focusable and `document.activeElement` remains the skip link. The next keyboard action has not been moved to the main content. This makes the required skip mechanism ineffective for keyboard users.

### P2 — deployed hashed assets are not long-lived immutable cached

Live response headers for both hashed build assets (`/assets/index-lSnFMGeD.js`, 27,512 bytes; `/assets/index-DeJnCtPO.css`, 14,680 bytes) are:

```
cache-control: public, must-revalidate, max-age=30
```

The PWA/performance contract requires long-lived immutable caching for hashed assets. The service worker does precache the shell, but normal browser loading revalidates these fingerprinted assets after 30 seconds instead of using immutable cache policy.

## Other defects / hardening gaps

### P3 — malformed JSON error is implementation text without recovery guidance

Uploading a file containing `{` renders the raw browser parser message, `Expected property name or '}' in JSON at position 1 (line 1 column 2)`. It does not identify the selected manifest or tell the photographer how to correct it (for example, use a JSON array of records or upload CSV). The error is recoverable by selecting a valid manifest/sample, but it does not meet the specified actionable-error language standard.

### P3 — deployment response-policy gaps

The live site has HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`, but no `Content-Security-Policy`, `Permissions-Policy`, or clickjacking policy was returned. `/manifest.webmanifest` is served as `application/octet-stream` rather than a manifest JSON media type. These did not produce a browser console error in Chromium, but should be corrected as deployment hardening.

## Evidence and completed checks

### Clean install, static checks, and repository suite

Performed from a fresh detached clone at `/tmp/raw-sidecar-sanity-qa.5Sdrei/app`:

```sh
npm ci                    # 58 packages; 0 vulnerabilities
npm test                  # 4/4 passed
npm run build             # passed; tsc --noEmit + Vite build; dist/ produced
npm run test:e2e          # 8/8 passed (desktop and 390 × 844)
npm audit --omit=dev      # 0 vulnerabilities
```

There is no separate lint script; `npm run build` performs the available TypeScript check. Production output is 27.51 KB JS (10.78 KB gzip), 14.68 KB CSS (4.10 KB gzip), and a 46.68 KB hero WebP, within the stated static budgets.

### Independent end-to-end exercise

- Normal manifest pair: 6000 × 4000 RAW plus 5976 × 3984 JPEG with exactly two seconds timestamp delta correctly reports **Pair agrees**.
- Boundary/contradiction manifest: a 4000 × 4000 JPEG with three seconds delta correctly reports aspect and time conflicts; timestamp filtering and CSV export worked.
- Invalid JSON rendered an error notice; subsequent labelled-sample analysis recovered successfully.
- Report persisted across reload; **Erase local reports** returned the checker to its empty state.
- Existing labelled sample confirms a real aspect/timestamp conflict, a clear pair, and an orphaned RAW. Free use issued no external requests.
- Desktop (1440 × 1100) and mobile (390 × 844) had no horizontal overflow. Console and page-error monitoring on the live free-analysis flow found none.
- The app has title, `lang="en"`, exactly one `h1`, one `main`, meaningful hero alt text, visible focus styling, and reduced-motion transition override. The report-state axe failure above prevents accessibility acceptance.

### Privacy and network behaviour

- During a live free inspection, every observed browser request was same-origin; no analytics, fonts, upload, or third-party script request occurred.
- Source review and the exercised flow show reports are stored in IndexedDB and file bytes are not persisted by the app. The sole potential external product request is the documented Sociobot billing endpoint after a user supplies/buys a license.

### PWA and offline/update checks

- The built manifest has standalone display, 192/512 maskable icons, theme/background colors, and a version query in `start_url`.
- Existing Playwright suite passed offline reload after a controlled first visit on desktop and mobile.
- Independent service-worker update simulation: install candidate shell, change only the served worker cache version from `raw-bench-v3` to `raw-bench-v4`, call `registration.update()`, and confirm the in-app notice **“An update is ready. Reload to use the new bench.”** with no console errors. `skipWaiting`/`clientsClaim` behaviour and versioned cache creation were observed.

### Live candidate identity and headers

The live files match the fresh candidate build byte-for-byte (SHA-256) for `index.html`, both hashed JS/CSS files, `sw.js`, manifest, offline page, privacy and terms pages, hero WebP, and icon SVG. The live response also returned HTTPS, HSTS, nosniff, and the response headers documented above. Therefore the failures are present on the live candidate rather than being a deployment version mismatch.

## Required remediation and re-verification

1. Correct the report eyebrow contrast and add an axe test that loads a report before scanning.
2. Make the skip target programmatically focusable and transfer focus on activation; add keyboard coverage.
3. Configure immutable, long-lived caching for fingerprinted `/assets/*` files while keeping `sw.js` update-checkable.
4. Replace raw JSON parser text with an actionable manifest error, and add the missing response policies/MIME configuration.
5. Re-run clean install, build, full E2E, desktop/mobile report-state axe, PWA offline/update, and live-header verification.
