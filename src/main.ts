import './styles.css';
import { analyseFacts, inspectionToCsv } from './analysis';
import { fileKind, parseManifest, readPhoto } from './metadata';
import { captureLicense, checkoutUrl, optimisticLicense, removeLicense, storeLicense, verifyLicense, type LicenseState } from './license';
import { clearInspections, listInspections, pruneInspections, saveInspection } from './storage';
import type { Inspection, IssueType, PairResult, PhotoFact, Severity } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
let current: Inspection | undefined;
let historyItems: Inspection[] = [];
let filter: IssueType | 'all' = 'all';
let busy = false;
let notice = '';
let license: LicenseState = optimisticLicense();
let activePage = pageFromPath();

captureLicense();
license = optimisticLicense();

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const severityLabel: Record<Severity, string> = { error: 'Conflict', warning: 'Check', note: 'Incomplete', ok: 'Clear' };

function pageFromPath(): 'home' | 'privacy' | 'terms' {
  return location.pathname === '/privacy' ? 'privacy' : location.pathname === '/terms' ? 'terms' : 'home';
}

function navigate(path: string): void {
  history.pushState({}, '', path);
  activePage = pageFromPath();
  render();
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function layout(content: string): string {
  return `
    <header class="site-header">
      <a class="brand" href="/" data-route><img src="/assets/icon.svg" alt="" width="40" height="40"><span>RAW Sidecar<br><strong>Sanity</strong></span></a>
      <nav aria-label="Primary"><a href="/#checker">Checker</a><a href="/#readers">Readers</a><a href="/#pro">Pro bench</a></nav>
      <span class="privacy-mark"><i aria-hidden="true"></i> Files stay here</span>
    </header>
    ${content}
    <footer>
      <div><strong>RAW Sidecar Sanity</strong><p>Independent preflight for photographers. No originals are changed or uploaded.</p></div>
      <div class="footer-links"><a href="/privacy" data-route>Privacy</a><a href="/terms" data-route>Terms</a><a href="https://github.com/B-Divyesh/sf-raw-sidecar-sanity">Source</a></div>
      <p class="generated-note">Console artwork was generated for this product; interface symbols are hand-authored.</p>
    </footer>`;
}

function legalPage(kind: 'privacy' | 'terms'): string {
  const privacy = `
    <h1>Your files stay on your bench.</h1>
    <p class="lede">RAW Sidecar Sanity is local-first. Inspection happens inside your browser, and image bytes are never uploaded by this app.</p>
    <h2>What is stored</h2><p>Inspection reports contain filenames and extracted metadata—not image bytes—and are stored in this browser’s IndexedDB. The free edition keeps the most recent report; an active Pro license keeps up to 30. Your license token and a daily verification verdict are stored in localStorage.</p>
    <h2>What leaves the device</h2><p>Nothing during an inspection. When you buy or verify Pro, your browser contacts the Sociobot billing API. Sociobot/Dodo is the merchant of record and handles payment data; this static app never receives card details. There is no analytics or advertising.</p>
    <h2>Your controls</h2><p>Use “Erase local reports” on the checker to remove report history. Remove a license from the Pro bench controls. Clearing site data also removes everything.</p>`;
  const terms = `
    <h1>Terms for a careful preflight.</h1>
    <p class="lede">RAW Sidecar Sanity is an independent diagnostic aid. It reports what its documented readers see; it is not a guarantee that every camera, catalog, or decoder will agree.</p>
    <h2>Use and limitations</h2><p>Always keep backups and verify important imports. The app never repairs or modifies originals. RAW formats vary and unsupported metadata is labeled “incomplete,” not guessed.</p>
    <h2>Pro purchase</h2><p>Pro is a $19 one-time license for one user and includes local history plus saved bench conveniences. Core checking and CSV export remain free. Sociobot/Dodo is the merchant of record. Refunds are handled there and revoke the associated license.</p>
    <h2>Warranty and license</h2><p>The software is provided “as is,” without warranty, under the MIT License. To the extent allowed by law, contributors are not liable for catalog, metadata, or business losses.</p>`;
  return layout(`<main id="main" class="legal"><a class="back-link" href="/" data-route>← Back to checker</a>${kind === 'privacy' ? privacy : terms}</main>`);
}

function summary(inspection: Inspection): { conflicts: number; checks: number; clear: number } {
  return inspection.results.reduce((total, result) => {
    if (result.status === 'error') total.conflicts += 1;
    else if (result.status === 'warning' || result.status === 'note') total.checks += 1;
    else total.clear += 1;
    return total;
  }, { conflicts: 0, checks: 0, clear: 0 });
}

function renderHome(): string {
  const totals = current ? summary(current) : { conflicts: 0, checks: 0, clear: 0 };
  return layout(`
    <main id="main">
      <section class="hero" aria-labelledby="title">
        <div class="hero-copy"><p class="eyebrow"><span aria-hidden="true">●</span> Pre-import instrument 01</p><h1 id="title">Catch a bad pair<br><em>before your catalog does.</em></h1><p class="lede">Compare RAW + camera JPEG facts on your device. Spot twisted aspect ratios, wandering capture times, and orphaned basenames before they become thumbnails and timelines.</p><a class="button primary" href="#checker">Inspect files</a><p class="microcopy">Private by design · Works offline · Originals untouched</p></div>
        <figure class="hero-art"><img src="/assets/inspection-console.webp" width="960" height="640" alt="A fictional mid-century photo inspection console with paired negative holders, matching gauges, and an amber status lamp" fetchpriority="high" decoding="async"><figcaption>Two files in. One trustworthy account out.</figcaption></figure>
      </section>
      <section id="checker" class="workbench" aria-labelledby="checker-title">
        <div class="section-heading"><div><p class="eyebrow">On-device preflight</p><h2 id="checker-title">Put a folder on the bench</h2><p>Select RAW and JPEG files together, or add an ExifTool-style CSV/JSON manifest for formats this browser cannot read.</p></div><div class="lamp ${current ? 'on' : ''}" aria-label="${current ? 'Inspection complete' : 'Bench ready'}"><i></i><span>${busy ? 'Reading' : current ? 'Report ready' : 'Ready'}</span></div></div>
        ${notice ? `<div class="notice" role="status">${escapeHtml(notice)}</div>` : ''}
        <div class="drop-zone ${busy ? 'busy' : ''}" aria-describedby="drop-help" aria-busy="${busy}">
          <span class="drop-icon" aria-hidden="true">↧</span><strong>${busy ? 'Reading metadata…' : 'Drop a folder, files, or manifest'}</strong><span id="drop-help">Pairing uses the filename before the extension. Nothing leaves this browser.</span>
          <div class="drop-actions"><button class="button primary" id="choose-files" type="button">Choose files</button><button class="button secondary" id="choose-folder" type="button">Choose folder</button><button class="text-button" id="load-sample" type="button">Try a labelled sample</button></div>
          <input id="file-input" type="file" multiple accept=".arw,.cr2,.cr3,.dng,.nef,.nrw,.orf,.pef,.raf,.raw,.rw2,.srw,.jpg,.jpeg,.csv,.json" hidden>
          <input id="folder-input" type="file" multiple webkitdirectory hidden>
        </div>
        ${current ? renderReport(current, totals) : `<div class="empty-state"><span>00</span><div><h3>No inspection yet</h3><p>Your comparison ledger will appear here with the most urgent contradictions first.</p></div></div>`}
      </section>
      <section id="readers" class="readers" aria-labelledby="readers-title"><div><p class="eyebrow">Reader ledger</p><h2 id="readers-title">It says who saw what.</h2><p>Every fact carries its source. JPEG dimensions come from the image frame; dates from EXIF. TIFF-based ARW, CR2, DNG, NEF and similar files are read from IFD/EXIF entries when exposed. CR3, RAF variants, maker notes, and embedded previews may be incomplete.</p></div><ol><li><strong>1. Pair</strong><span>Case-insensitive basename or explicit manifest key.</span></li><li><strong>2. Compare</strong><span>Aspect differs by &gt;1%; time by &gt;2 seconds.</span></li><li><strong>3. Explain</strong><span>No guessed dates and no file-modified fallback.</span></li></ol></section>
      ${renderPro()}
    </main>`);
}

function renderReport(inspection: Inspection, totals: ReturnType<typeof summary>): string {
  const visible = filter === 'all' ? inspection.results : inspection.results.filter((result) => result.issues.some((issue) => issue.type === filter));
  const availableTypes: Array<IssueType | 'all'> = ['all', 'aspect', 'timestamp', 'basename', 'dimension', 'reader'];
  return `<section class="report" aria-labelledby="report-title">
    <div class="report-top"><div><p class="eyebrow">Inspection ${escapeHtml(inspection.id.slice(0, 8))}</p><h3 id="report-title">${inspection.results.length} pair${inspection.results.length === 1 ? '' : 's'} examined</h3><p>${inspection.fileCount} records · ${escapeHtml(formatDate(inspection.createdAt))}</p></div><div class="summary-dials"><span class="dial danger"><b>${totals.conflicts}</b> conflicts</span><span class="dial warning"><b>${totals.checks}</b> check</span><span class="dial safe"><b>${totals.clear}</b> clear</span></div></div>
    <div class="report-tools"><div class="filters" role="group" aria-label="Filter issues">${availableTypes.map((type) => `<button type="button" data-filter="${type}" aria-pressed="${filter === type}">${type === 'all' ? 'All pairs' : type === 'reader' ? 'Incomplete' : type}</button>`).join('')}</div><button class="button secondary" id="export-csv" type="button">Export CSV</button></div>
    <div class="result-list" aria-live="polite">${visible.length ? visible.map((result) => renderPair(result, filter)).join('') : `<p class="no-filter-results">No pairs match this filter.</p>`}</div>
  </section>`;
}

function dimensions(fact?: PhotoFact): string { return fact?.width && fact.height ? `${fact.width.toLocaleString()} × ${fact.height.toLocaleString()}` : 'Not readable'; }

function renderPair(result: PairResult, highlighted: IssueType | 'all' = 'all'): string {
  const issue = highlighted === 'all' ? result.issues[0] : result.issues.find((item) => item.type === highlighted) ?? result.issues[0];
  const remaining = result.issues.filter((item) => item !== issue);
  return `<article class="result ${result.status}"><div class="result-status"><span class="status-shape" aria-hidden="true"></span><span>${severityLabel[result.status]}</span></div><div class="result-main"><h4>${escapeHtml(result.raw?.stem ?? result.jpeg?.stem ?? result.pairKey)}</h4><p class="headline">${escapeHtml(issue.title)}</p><p>${escapeHtml(issue.detail)}</p><details><summary>Reader details and ${remaining.length ? `${remaining.length} more finding${remaining.length > 1 ? 's' : ''}` : 'metadata'}</summary><div class="fact-grid"><div><b>RAW</b><span>${escapeHtml(result.raw?.name ?? 'Missing')}</span><span>${dimensions(result.raw)}</span><span>${escapeHtml(result.raw?.timestamp ?? 'No capture time')}</span><small>${escapeHtml(result.raw?.reader ?? '—')}</small></div><div><b>JPEG</b><span>${escapeHtml(result.jpeg?.name ?? 'Missing')}</span><span>${dimensions(result.jpeg)}</span><span>${escapeHtml(result.jpeg?.timestamp ?? 'No capture time')}</span><small>${escapeHtml(result.jpeg?.reader ?? '—')}</small></div></div>${remaining.map((item) => `<p class="extra-finding"><b>${escapeHtml(item.title)}:</b> ${escapeHtml(item.detail)}</p>`).join('')}</details></div></article>`;
}

function renderPro(): string {
  const status = license.unlocked ? 'Pro active' : 'Free bench';
  return `<section id="pro" class="pro" aria-labelledby="pro-title"><div><p class="eyebrow">${status}</p><h2 id="pro-title">Keep the bench history.<br><em>$19 once.</em></h2><p>Core checking, CSV export, and every safety warning are free. Pro keeps up to 30 local inspection reports so you can revisit a shoot after import. One-time purchase; no subscription.</p><div class="pro-actions">${license.unlocked ? `<button class="button secondary" id="remove-license" type="button">Remove license</button>` : `<a class="button primary" href="${checkoutUrl}">Buy Pro for $19</a>`}<button class="text-button" id="toggle-restore" type="button">Have a license? Paste it</button></div>${license.message ? `<p class="license-message" role="status">${escapeHtml(license.message)}</p>` : ''}<form id="restore-form" class="restore-form" hidden><label for="license-token">License token</label><div><input id="license-token" name="license" autocomplete="off" required><button class="button secondary" type="submit">Verify license</button></div></form><p class="legal-line">Sociobot/Dodo is the merchant of record. Refunds are handled there. <a href="/privacy" data-route>Privacy</a> · <a href="/terms" data-route>Terms</a></p></div><div class="history-panel"><div class="panel-label"><span>Local report register</span><button id="erase-reports" type="button">Erase local reports</button></div>${license.unlocked ? (historyItems.length ? `<ol>${historyItems.slice(0, 5).map((item) => `<li><button type="button" data-history="${escapeHtml(item.id)}"><b>${escapeHtml(item.label)}</b><span>${item.results.length} pairs · ${escapeHtml(formatDate(item.createdAt))}</span></button></li>`).join('')}</ol>` : `<p>No saved reports yet. Your next inspection will be recorded here.</p>`) : `<div class="locked-history"><span aria-hidden="true">⌁</span><p>Your latest report survives refresh. Pro expands the register to 30 inspections.</p></div>`}</div></section>`;
}

function render(): void {
  app.innerHTML = activePage === 'home' ? renderHome() : legalPage(activePage);
  bindEvents();
}

function bindEvents(): void {
  app.querySelectorAll<HTMLAnchorElement>('[data-route]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); navigate(new URL(link.href).pathname); }));
  if (activePage !== 'home') return;
  const zone = app.querySelector<HTMLElement>('.drop-zone')!;
  const fileInput = app.querySelector<HTMLInputElement>('#file-input')!;
  const folderInput = app.querySelector<HTMLInputElement>('#folder-input')!;
  app.querySelector('#choose-files')?.addEventListener('click', () => fileInput.click());
  app.querySelector('#choose-folder')?.addEventListener('click', () => folderInput.click());
  for (const eventName of ['dragenter', 'dragover']) zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', (event) => { event.preventDefault(); zone.classList.remove('dragging'); if (event.dataTransfer?.files.length) void processFiles([...event.dataTransfer.files]); });
  fileInput.addEventListener('change', () => { if (fileInput.files) void processFiles([...fileInput.files]); });
  folderInput.addEventListener('change', () => { if (folderInput.files) void processFiles([...folderInput.files]); });
  app.querySelector('#load-sample')?.addEventListener('click', () => void loadSample());
  app.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => button.addEventListener('click', () => { filter = button.dataset.filter as typeof filter; render(); document.querySelector('#report-title')?.scrollIntoView({ block: 'start' }); }));
  app.querySelector('#export-csv')?.addEventListener('click', exportCsv);
  app.querySelector('#toggle-restore')?.addEventListener('click', () => { const form = app.querySelector<HTMLFormElement>('#restore-form')!; form.hidden = !form.hidden; if (!form.hidden) form.querySelector<HTMLInputElement>('input')?.focus(); });
  app.querySelector('#restore-form')?.addEventListener('submit', (event) => void restoreLicense(event));
  app.querySelector('#remove-license')?.addEventListener('click', () => { removeLicense(); license = { unlocked: false, message: 'License removed from this browser.' }; void pruneInspections(1); render(); });
  app.querySelector('#erase-reports')?.addEventListener('click', async () => { await clearInspections(); historyItems = []; current = undefined; notice = 'Local inspection reports erased.'; render(); });
  app.querySelectorAll<HTMLButtonElement>('[data-history]').forEach((button) => button.addEventListener('click', () => { current = historyItems.find((item) => item.id === button.dataset.history); filter = 'all'; render(); document.querySelector('#report-title')?.scrollIntoView(); }));
}

async function processFiles(files: File[]): Promise<void> {
  if (busy) return;
  busy = true; notice = ''; render();
  try {
    const facts: PhotoFact[] = [];
    let skipped = 0;
    for (const file of files) {
      const kind = fileKind(file.name);
      if (kind === 'manifest') facts.push(...parseManifest(await file.text(), file.name));
      else if (kind === 'raw' || kind === 'jpeg') facts.push(await readPhoto(file));
      else skipped += 1;
    }
    if (!facts.length) throw new Error('No supported RAW, JPEG, CSV, or JSON records were found. Choose the original pair files or a supported manifest.');
    current = analyseFacts(facts, files.length === 1 ? files[0].name : `${files.length} selected files`);
    await saveInspection(current);
    await pruneInspections(license.unlocked ? 30 : 1);
    historyItems = await listInspections();
    filter = 'all';
    notice = `${current.results.length} pair${current.results.length === 1 ? '' : 's'} inspected${skipped ? `; ${skipped} unsupported file${skipped === 1 ? '' : 's'} ignored` : ''}.`;
  } catch (error) { notice = error instanceof Error ? error.message : 'The files could not be read. Try a CSV manifest instead.'; }
  finally { busy = false; render(); document.querySelector('#checker-title')?.scrollIntoView({ block: 'start' }); }
}

async function loadSample(): Promise<void> {
  const sample = `file,pair,kind,width,height,timestamp\nDSC0042.ARW,DSC0042,raw,4672,7008,2026-06-22T14:21:00\nDSC0042.JPG,DSC0042,jpeg,5120,7168,2026-06-22T14:21:09\nDSC0043.NEF,DSC0043,raw,6048,4024,2026-06-22T14:22:00\nDSC0043.JPG,DSC0043,jpeg,6000,4000,2026-06-22T14:22:00\nDSC0044.ARW,DSC0044,raw,7008,4672,2026-06-22T14:23:00`;
  const facts = parseManifest(sample, 'labelled-sample.csv');
  current = analyseFacts(facts, 'Labelled sample');
  await saveInspection(current); await pruneInspections(license.unlocked ? 30 : 1); historyItems = await listInspections();
  notice = 'Sample loaded: one aspect/time conflict, one clear pair, and one orphaned RAW.'; render(); document.querySelector('#report-title')?.scrollIntoView();
}

function exportCsv(): void {
  if (!current) return;
  const blob = new Blob([inspectionToCsv(current)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `raw-sidecar-sanity-${current.createdAt.slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  notice = 'CSV report exported.'; render();
}

async function restoreLicense(event: Event): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement; const data = new FormData(form); const token = String(data.get('license') ?? '').trim();
  if (!token) return;
  storeLicense(token); license = { ...optimisticLicense(), checking: true, message: 'Verifying license…' }; render();
  license = await verifyLicense(true); historyItems = await listInspections(); render();
}

window.addEventListener('popstate', () => { activePage = pageFromPath(); render(); });
window.addEventListener('online', () => { notice = 'Back online. File inspection always stays on-device.'; render(); });
window.addEventListener('offline', () => { notice = 'Offline mode: the checker and saved report still work.'; render(); });

async function start(): Promise<void> {
  historyItems = await listInspections().catch(() => []);
  current = historyItems[0];
  render();
  if (localStorage.getItem('sb_license:raw-sidecar-sanity')) void verifyLicense().then((state) => { license = state; render(); });
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('/sw.js');
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) { notice = 'An update is ready. Reload to use the new bench.'; render(); } }); });
  }
}

void start();
