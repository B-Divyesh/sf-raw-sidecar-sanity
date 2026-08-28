import type { Kind, PhotoFact } from './types';

const RAW_EXTENSIONS = new Set(['arw', 'cr2', 'cr3', 'dng', 'nef', 'nrw', 'orf', 'pef', 'raf', 'raw', 'rw2', 'srw']);
const JPEG_EXTENSIONS = new Set(['jpg', 'jpeg']);

export function fileKind(name: string): Kind {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (RAW_EXTENSIONS.has(extension)) return 'raw';
  if (JPEG_EXTENSIONS.has(extension)) return 'jpeg';
  if (extension === 'csv' || extension === 'json') return 'manifest';
  return 'unknown';
}

export function fileStem(name: string): string {
  const leaf = name.replaceAll('\\', '/').split('/').pop() ?? name;
  return leaf.replace(/\.[^.]+$/, '');
}

function ascii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let index = 0; index < length && offset + index < view.byteLength; index += 1) {
    const value = view.getUint8(offset + index);
    if (value === 0) break;
    out += String.fromCharCode(value);
  }
  return out.trim();
}

interface TiffFacts { width?: number; height?: number; timestamp?: string }

function parseTiff(view: DataView, base = 0): TiffFacts {
  if (base + 8 > view.byteLength) return {};
  const marker = String.fromCharCode(view.getUint8(base), view.getUint8(base + 1));
  const little = marker === 'II';
  if (!little && marker !== 'MM') return {};
  if (view.getUint16(base + 2, little) !== 42) return {};
  const typeSize: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const result: TiffFacts = {};
  let bestArea = 0;
  const seen = new Set<number>();

  const valueAt = (entry: number, type: number, count: number, item = 0): number | undefined => {
    const bytes = (typeSize[type] ?? 1) * count;
    const start = bytes <= 4 ? entry + 8 : base + view.getUint32(entry + 8, little);
    const offset = start + item * (typeSize[type] ?? 1);
    if (offset < 0 || offset + (typeSize[type] ?? 1) > view.byteLength) return undefined;
    if (type === 3) return view.getUint16(offset, little);
    if (type === 4) return view.getUint32(offset, little);
    if (type === 9) return view.getInt32(offset, little);
    if (type === 1 || type === 7) return view.getUint8(offset);
    return undefined;
  };

  const visit = (relativeOffset: number, depth: number) => {
    const ifd = base + relativeOffset;
    if (depth > 5 || seen.has(ifd) || ifd < 0 || ifd + 2 > view.byteLength) return;
    seen.add(ifd);
    const entries = Math.min(view.getUint16(ifd, little), 1024);
    if (ifd + 2 + entries * 12 + 4 > view.byteLength) return;
    let width: number | undefined;
    let height: number | undefined;
    const childOffsets: number[] = [];
    for (let index = 0; index < entries; index += 1) {
      const entry = ifd + 2 + index * 12;
      const tag = view.getUint16(entry, little);
      const type = view.getUint16(entry + 2, little);
      const count = view.getUint32(entry + 4, little);
      if (!typeSize[type] || count > 100_000) continue;
      const value = valueAt(entry, type, count);
      if (tag === 0x0100 || tag === 0xa002) width = value;
      if (tag === 0x0101 || tag === 0xa003) height = value;
      if ((tag === 0x8769 || tag === 0x8825) && value) childOffsets.push(value);
      if (tag === 0x014a) {
        for (let item = 0; item < Math.min(count, 24); item += 1) {
          const child = valueAt(entry, type, count, item);
          if (child) childOffsets.push(child);
        }
      }
      if ((tag === 0x9003 || tag === 0x9004 || tag === 0x0132) && type === 2 && !result.timestamp) {
        const bytes = count;
        const start = bytes <= 4 ? entry + 8 : base + view.getUint32(entry + 8, little);
        if (start >= 0 && start + bytes <= view.byteLength) result.timestamp = ascii(view, start, bytes);
      }
    }
    if (width && height && width * height > bestArea) {
      bestArea = width * height;
      result.width = width;
      result.height = height;
    }
    childOffsets.forEach((offset) => visit(offset, depth + 1));
    const next = view.getUint32(ifd + 2 + entries * 12, little);
    if (next) visit(next, depth + 1);
  };

  visit(view.getUint32(base + 4, little), 0);
  return result;
}

function parseJpeg(view: DataView): TiffFacts {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};
  const facts: TiffFacts = {};
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > view.byteLength) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
      facts.height = view.getUint16(offset + 5);
      facts.width = view.getUint16(offset + 7);
    }
    if (marker === 0xe1 && length > 8 && ascii(view, offset + 4, 6).startsWith('Exif')) {
      Object.assign(facts, { ...facts, ...parseTiff(view, offset + 10) });
    }
    offset += length + 2;
  }
  return facts;
}

function normaliseTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : value.trim();
}

export async function readPhoto(file: File): Promise<PhotoFact> {
  const kind = fileKind(file.name);
  const stem = fileStem(file.name);
  const id = `${file.name}:${file.size}:${file.lastModified}`;
  if (kind === 'unknown') return { id, name: file.name, stem, pairKey: stem.toLowerCase(), kind, reader: 'Filename only', parseNote: 'File type is not supported.' };
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const facts = kind === 'jpeg' ? parseJpeg(view) : parseTiff(view);
  const supported = facts.width || facts.height || facts.timestamp;
  return {
    id,
    name: file.name,
    stem,
    pairKey: stem.toLowerCase(),
    kind,
    reader: kind === 'jpeg' ? 'JPEG frame + EXIF' : 'TIFF/RAW IFD + EXIF',
    ...facts,
    timestamp: normaliseTimestamp(facts.timestamp),
    parseNote: supported ? undefined : kind === 'raw' ? 'This RAW container did not expose readable TIFF/EXIF facts. Its filename can still be paired.' : 'No readable JPEG frame or EXIF metadata was found.'
  };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseManifest(text: string, sourceName = 'manifest.csv'): PhotoFact[] {
  let rows: Array<Record<string, unknown>> = [];
  if (sourceName.toLowerCase().endsWith('.json')) {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('JSON manifest must be an array of file records.');
    rows = parsed as Array<Record<string, unknown>>;
  } else {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error('CSV manifest needs a header and at least one file row.');
    const header = splitCsvLine(lines[0]).map((value) => value.toLowerCase());
    rows = lines.slice(1).map((line) => Object.fromEntries(splitCsvLine(line).map((value, index) => [header[index], value])));
  }
  return rows.map((row, index) => {
    const name = String(row.file ?? row.filename ?? row.name ?? row.sourcefile ?? '').trim();
    if (!name) throw new Error(`Manifest row ${index + 1} is missing a file name.`);
    const stem = fileStem(name);
    const pairKey = String(row.pair ?? row.pair_key ?? stem).trim().toLowerCase();
    const imageSize = String(row.imagesize ?? '').match(/(\d+)\s*[x×]\s*(\d+)/i);
    const width = Number(row.width ?? row.imagewidth ?? row.exifimagewidth ?? imageSize?.[1] ?? 0) || undefined;
    const height = Number(row.height ?? row.imageheight ?? row.exifimageheight ?? imageSize?.[2] ?? 0) || undefined;
    const explicitKind = String(row.kind ?? row.type ?? '').toLowerCase();
    const inferred = fileKind(name);
    const kind: Kind = explicitKind === 'raw' || explicitKind === 'jpeg' ? explicitKind : inferred;
    return { id: `${sourceName}:${index}:${name}`, name, stem, pairKey, kind, reader: 'Manifest', width, height, timestamp: normaliseTimestamp(String(row.timestamp ?? row.datetimeoriginal ?? row.date ?? '') || undefined) };
  });
}
