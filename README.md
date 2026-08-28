# RAW Sidecar Sanity

RAW Sidecar Sanity is a local-first preflight for photographers who import RAW and camera JPEG pairs. It finds basename orphans, aspect-ratio contradictions, implausible dimensions, and capture-time disagreements before a catalog turns them into distorted thumbnails or broken timelines.

Live: https://raw-sidecar-sanity.sociobot.in

## What it does

- Accepts individual files, an entire browser-selected folder, or CSV/JSON manifests.
- Pairs files by case-insensitive basename or an explicit manifest `pair` key.
- Reads JPEG frame/EXIF data and common TIFF/EXIF structures in ARW, CR2, DNG, NEF, ORF, PEF, RW2, SRW, and related containers.
- Reports the reader used for every fact and marks unsupported metadata as incomplete rather than guessing.
- Exports findings as CSV and saves report metadata locally in IndexedDB. Image bytes are never retained or uploaded.
- Installs as a PWA and works offline after the first completed visit.

CR3, RAF variants, maker notes, and some embedded previews are not fully parseable in a browser. For those, export a manifest with ExifTool and inspect that alongside—or instead of—the originals. The parser accepts fields such as `SourceFile`, `ImageWidth`, `ImageHeight`, `ImageSize`, and `DateTimeOriginal`, plus optional `pair` and `kind` fields.

## Free and Pro

Checking, safety findings, and CSV export are free. A $19 one-time Pro license keeps up to 30 local inspection reports instead of the latest report only. Checkout and verification use the Sociobot billing API; there is no embedded payment provider.

## Run, test, and build

```sh
npm install
npm run dev
npm test          # unit + labelled 200-pair corpus
npm run build     # reproducible static output in dist/
npm run test:e2e  # Chromium desktop/mobile, axe, offline PWA
```

The static deployment root is `dist/`; `dist/index.html` is the entry point. No environment variable is required. The factory registers the paid product and manages hosting/DNS separately.

The researched scope is in `.factory/brief.json`, the visual system and artwork provenance are in `.factory/design.md`, and release verification is in `.factory/handoff.md`.

Licensed under MIT. See `LICENSE`.
