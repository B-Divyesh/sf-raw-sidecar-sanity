import type { Inspection, PairResult, PhotoFact, Severity } from './types';

const severityRank: Record<Severity, number> = { error: 4, warning: 3, note: 2, ok: 1 };

function seconds(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed / 1000;
}

function ratio(fact: PhotoFact): number | undefined {
  return fact.width && fact.height ? fact.width / fact.height : undefined;
}

export function analyseFacts(facts: PhotoFact[], label = 'Local inspection'): Inspection {
  const groups = new Map<string, PhotoFact[]>();
  facts.filter((fact) => fact.kind === 'raw' || fact.kind === 'jpeg').forEach((fact) => {
    const group = groups.get(fact.pairKey) ?? [];
    group.push(fact);
    groups.set(fact.pairKey, group);
  });

  const results: PairResult[] = [...groups.entries()].flatMap(([pairKey, members]) => {
    const raws = members.filter((fact) => fact.kind === 'raw');
    const jpegs = members.filter((fact) => fact.kind === 'jpeg');
    const count = Math.max(raws.length, jpegs.length, 1);
    return Array.from({ length: count }, (_, index) => buildPair(pairKey, raws[index], jpegs[index], index));
  });
  results.sort((a, b) => severityRank[b.status] - severityRank[a.status] || a.pairKey.localeCompare(b.pairKey));
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), label, fileCount: facts.length, results };
}

function buildPair(pairKey: string, raw?: PhotoFact, jpeg?: PhotoFact, duplicateIndex = 0): PairResult {
  const issues: PairResult['issues'] = [];
  if (!raw || !jpeg) {
    const present = raw ?? jpeg;
    issues.push({ type: 'basename', severity: 'warning', title: `${raw ? 'JPEG' : 'RAW'} side is missing`, detail: `${present?.name ?? pairKey} has no same-basename ${raw ? 'JPEG' : 'RAW'} partner.` });
  } else {
    if (raw.stem.toLowerCase() !== jpeg.stem.toLowerCase()) {
      issues.push({ type: 'basename', severity: 'warning', title: 'Basenames disagree', detail: `${raw.name} is paired with ${jpeg.name} by the manifest key “${pairKey}”.` });
    }
    for (const fact of [raw, jpeg]) {
      if ((fact.width && fact.width < 256) || (fact.height && fact.height < 256) || (fact.width && fact.height && fact.width * fact.height > 250_000_000)) {
        issues.push({ type: 'dimension', severity: 'error', title: 'Implausible dimensions', detail: `${fact.name} reports ${fact.width ?? '?'} × ${fact.height ?? '?'} px via ${fact.reader}.` });
      }
    }
    const rawRatio = ratio(raw);
    const jpegRatio = ratio(jpeg);
    if (rawRatio && jpegRatio) {
      const delta = Math.abs(rawRatio - jpegRatio) / Math.max(rawRatio, jpegRatio);
      if (delta > 0.01) issues.push({ type: 'aspect', severity: 'error', title: 'Aspect ratios disagree', detail: `${raw.name} is ${raw.width} × ${raw.height} (${rawRatio.toFixed(3)}); ${jpeg.name} is ${jpeg.width} × ${jpeg.height} (${jpegRatio.toFixed(3)}). Difference: ${(delta * 100).toFixed(1)}%.` });
    } else {
      const missing = [raw, jpeg].filter((fact) => !ratio(fact)).map((fact) => fact.name).join(' and ');
      issues.push({ type: 'reader', severity: 'note', title: 'Aspect check incomplete', detail: `No readable dimensions for ${missing}. The file was not modified.` });
    }
    if (raw.timestamp && jpeg.timestamp) {
      const rawSeconds = seconds(raw.timestamp);
      const jpegSeconds = seconds(jpeg.timestamp);
      if (rawSeconds !== undefined && jpegSeconds !== undefined) {
        const delta = Math.abs(rawSeconds - jpegSeconds);
        if (delta > 2) issues.push({ type: 'timestamp', severity: delta > 60 ? 'error' : 'warning', title: 'Capture times disagree', detail: `${raw.name}: ${raw.timestamp}; ${jpeg.name}: ${jpeg.timestamp}. Difference: ${Math.round(delta)} seconds.` });
      } else if (raw.timestamp !== jpeg.timestamp) {
        issues.push({ type: 'timestamp', severity: 'warning', title: 'Timestamp text disagrees', detail: `${raw.timestamp} versus ${jpeg.timestamp}; at least one value could not be parsed.` });
      }
    } else {
      const missing = [raw, jpeg].filter((fact) => !fact.timestamp).map((fact) => fact.name).join(' and ');
      issues.push({ type: 'reader', severity: 'note', title: 'Time check incomplete', detail: `No capture timestamp was readable for ${missing}. File modification time is intentionally ignored.` });
    }
    for (const fact of [raw, jpeg]) if (fact.parseNote) issues.push({ type: 'reader', severity: 'note', title: `${fact.kind.toUpperCase()} reader note`, detail: fact.parseNote });
  }
  if (!issues.length) issues.push({ type: 'ok', severity: 'ok', title: 'Pair agrees', detail: 'Aspect ratio, capture time, and basename agree within the documented tolerances.' });
  const status = issues.reduce<Severity>((worst, issue) => severityRank[issue.severity] > severityRank[worst] ? issue.severity : worst, 'ok');
  return { id: `${pairKey}:${duplicateIndex}`, pairKey, raw, jpeg, issues, status };
}

export function inspectionToCsv(inspection: Inspection): string {
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const header = ['pair', 'status', 'issue_type', 'message', 'raw_file', 'raw_dimensions', 'raw_timestamp', 'raw_reader', 'jpeg_file', 'jpeg_dimensions', 'jpeg_timestamp', 'jpeg_reader'];
  const rows = inspection.results.flatMap((result) => result.issues.map((issue) => [result.pairKey, issue.severity, issue.type, `${issue.title}: ${issue.detail}`, result.raw?.name, result.raw?.width && result.raw?.height ? `${result.raw.width}x${result.raw.height}` : '', result.raw?.timestamp, result.raw?.reader, result.jpeg?.name, result.jpeg?.width && result.jpeg?.height ? `${result.jpeg.width}x${result.jpeg.height}` : '', result.jpeg?.timestamp, result.jpeg?.reader]));
  return [header, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
}
