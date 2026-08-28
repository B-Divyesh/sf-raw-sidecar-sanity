import { analyseFacts, inspectionToCsv } from './analysis';
import { parseManifest, readPhoto } from './metadata';
import type { PhotoFact } from './types';

function fact(index: number, kind: 'raw' | 'jpeg', patch: Partial<PhotoFact> = {}): PhotoFact {
  const stem = `IMG_${String(index).padStart(4, '0')}`;
  return {
    id: `${index}-${kind}`,
    name: `${stem}.${kind === 'raw' ? 'ARW' : 'JPG'}`,
    stem,
    pairKey: stem.toLowerCase(),
    kind,
    reader: 'Manifest',
    width: kind === 'raw' ? 6000 : 5976,
    height: kind === 'raw' ? 4000 : 3984,
    timestamp: `2026-08-28T12:${String(index % 60).padStart(2, '0')}:00`,
    ...patch
  };
}

describe('pair analysis', () => {
  it('meets the labelled 200-pair accuracy target', () => {
    const facts: PhotoFact[] = [];
    const expectedConflict = new Set<number>();
    for (let index = 0; index < 200; index += 1) {
      const raw = fact(index, 'raw');
      let jpeg: PhotoFact | undefined = fact(index, 'jpeg');
      if (index >= 140 && index < 160) { jpeg = fact(index, 'jpeg', { width: 5120, height: 7168 }); expectedConflict.add(index); }
      if (index >= 160 && index < 180) { jpeg = fact(index, 'jpeg', { timestamp: `2026-08-28T13:${String(index % 60).padStart(2, '0')}:00` }); expectedConflict.add(index); }
      if (index >= 180) { jpeg = undefined; expectedConflict.add(index); }
      facts.push(raw); if (jpeg) facts.push(jpeg);
    }
    const report = analyseFacts(facts);
    const positives = new Set(report.results.filter((result) => result.status === 'error' || result.status === 'warning').map((result) => Number(result.pairKey.slice(-4))));
    const truePositives = [...expectedConflict].filter((index) => positives.has(index)).length;
    const falsePositives = [...positives].filter((index) => !expectedConflict.has(index)).length;
    expect(truePositives / expectedConflict.size).toBeGreaterThanOrEqual(.95);
    expect(falsePositives / (200 - expectedConflict.size)).toBeLessThan(.03);
  });

  it('attributes manifest readers and exports all findings', () => {
    const facts = parseManifest('file,pair,kind,width,height,timestamp\nA.ARW,shoot-1,raw,6000,4000,2026-01-01T10:00:00\nB.JPG,shoot-1,jpeg,4000,4000,2026-01-01T10:03:00');
    const report = analyseFacts(facts);
    expect(report.results[0].issues.map((issue) => issue.type)).toEqual(expect.arrayContaining(['basename', 'aspect', 'timestamp']));
    expect(inspectionToCsv(report)).toContain('Manifest');
    expect(inspectionToCsv(report)).toContain('Basenames disagree');
  });

  it('rejects malformed manifests with a useful row error', () => {
    expect(() => parseManifest('file,width\n,6000')).toThrow('row 1 is missing a file name');
    expect(() => parseManifest('{"file":"A.ARW"}', 'facts.json')).toThrow('must be an array');
  });

  it('reads JPEG frame dimensions without decoding pixels', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x0f, 0xa0, 0x17, 0x70, 0x03, 1, 1, 0, 2, 1, 0, 3, 1, 0, 0xff, 0xd9]);
    const file = new File([bytes], 'FRAME.JPG', { type: 'image/jpeg' });
    const read = await readPhoto(file);
    expect([read.width, read.height]).toEqual([6000, 4000]);
    expect(read.reader).toBe('JPEG frame + EXIF');
  });
});
