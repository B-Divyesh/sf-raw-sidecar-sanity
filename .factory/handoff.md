# Handoff — RAW Sidecar Sanity v1

## Independent verification status: **FAIL**

Candidate `0671efbcc4a332e98d4939a8fa558a3cc7974900` was independently verified against https://raw-sidecar-sanity.sociobot.in on 2026-08-28 UTC. The live deployment byte-matches the candidate, but it is **not accepted**. See `.factory/verification.md` for exact commands and evidence.

- **P1:** after a real report is rendered, axe finds serious report-eyebrow colour contrast of 1.72:1 (required 4.5:1).
- **P2:** activating the keyboard skip link does not move focus into `<main>`.
- **P2:** hashed live JS/CSS assets use `Cache-Control: public, must-revalidate, max-age=30`, not the required immutable long-lived caching.
- **P3:** malformed JSON exposes raw parser text without corrective guidance; the deployment lacks CSP/Permissions/clickjacking policy and serves the manifest as `application/octet-stream`.

The clean candidate install, unit suite (4/4), typecheck/production build, existing E2E suite (8/8), independent normal/boundary/invalid/recovery flow, offline reload, update-notice simulation, bundle budget, and free-flow privacy/network checks otherwise passed. This status supersedes the builder’s verification summary below; do not release as PASS until the listed defects are fixed and reverified.

## What shipped

- A responsive, local-only RAW/JPEG preflight with file, folder, drag/drop, CSV, JSON, and labelled-sample entry paths.
- Case-insensitive basename pairing plus explicit manifest pairing; conservative aspect (>1%), capture-time (>2 s), basename, and implausible-dimension findings.
- Lightweight JPEG frame/EXIF and TIFF/RAW IFD/EXIF readers. Every displayed fact names its reader; missing coverage is shown as incomplete and file modification time is never substituted.
- Accessible severity-first comparison ledger, per-finding filters, reader details, and unrestricted CSV export.
- IndexedDB report persistence without image bytes. Free keeps the latest report; Pro keeps 30.
- $19 one-time Sociobot license flow: hosted checkout, URL-token capture and cleanup, paste-to-restore, cached optimistic unlock, non-blocking daily verification, offline cached-verdict handling, and revocation behavior. No product ID is hardcoded; the slug URL awaits factory registration.
- Installable PWA with 192/512 maskable icons, versioned shell/hashed-asset caching, offline navigation, and an update-ready notice.
- Dedicated static and client-routed `/privacy` and `/terms` pages, MIT license, full README, and no analytics, third-party runtime scripts, or CDN fonts.
- Original mid-century lab-console hero. Source PNG and generator sidecars are in `assets/src/`; the shipped 960×640 WebP is 46 KB. Prompt, model/deployment, date, review, and license provenance are recorded in `.factory/design.md`.

## Verification (2026-08-28 UTC)

- `npm test`: 4/4 tests passed, including a labelled 200-pair corpus. All 60 injected aspect, timestamp, and orphan-basename conflicts were detected (100% in the test corpus) with 0 false positives among 140 valid pairs.
- `npm run build`: passed; output is `dist/` with `dist/index.html` at its root.
- `npm run test:e2e`: 8/8 Chromium tests passed across desktop and a 390×844 mobile viewport. Covered sample analysis, filtering, CSV download, title/lang/main/h1/alt checks, legal routes, horizontal overflow, console errors, and explicit `context.setOffline(true)` reload.
- axe-core Playwright scan: 0 serious or critical violations on desktop and mobile.
- Lighthouse mobile-class local production run: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.7 s, CLS 0, total blocking time 0 ms.
- Production bundle: 27.51 KB JavaScript / 10.78 KB gzip; 14.68 KB CSS / 4.10 KB gzip; 46 KB hero WebP. All are below the stated budgets.
- `npm audit --omit=dev`: 0 vulnerabilities. Full install audit also reported 0 vulnerabilities.
- Visual inspection completed at 1440×1100 and 390×844; focus, stacking, reading order, and touch targets checked.

## Run and deploy

```sh
npm install
npm test
npm run build
npm run test:e2e
```

Deploy the contents of `dist/` as the static root. The production domain is `https://raw-sidecar-sanity.sociobot.in`. The factory must register the `raw-sidecar-sanity` billing product/return URL; no infrastructure, DNS, billing registration, or secret was changed here.

## Known gaps and next steps

- Browser RAW coverage remains intentionally partial. CR3, many RAF variants, maker-note-only values, and unusual TIFF layouts may expose only a filename. The ExifTool-compatible manifest path is the documented fallback.
- The 200-pair accuracy gate is a deterministic labelled metadata corpus, not a diverse physical set of camera-original binaries. Before expanding claimed camera support, validate against consented real files from each listed make and record format-specific fixtures.
- Image timestamps without timezone offsets are compared as wall-clock values, which matches same-camera RAW/JPEG pairs but is not a timezone reconciliation tool.
- The live checkout/verify round trip cannot pass until the factory registers the product. Free analysis never waits for that external service.
