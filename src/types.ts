export type Kind = 'raw' | 'jpeg' | 'manifest' | 'unknown';
export type Reader = 'JPEG frame + EXIF' | 'TIFF/RAW IFD + EXIF' | 'Manifest' | 'Filename only';

export interface PhotoFact {
  id: string;
  name: string;
  stem: string;
  pairKey: string;
  kind: Kind;
  reader: Reader;
  width?: number;
  height?: number;
  timestamp?: string;
  parseNote?: string;
}

export type IssueType = 'aspect' | 'timestamp' | 'basename' | 'dimension' | 'reader' | 'ok';
export type Severity = 'error' | 'warning' | 'note' | 'ok';

export interface PairResult {
  id: string;
  pairKey: string;
  raw?: PhotoFact;
  jpeg?: PhotoFact;
  issues: Array<{ type: IssueType; severity: Severity; title: string; detail: string }>;
  status: Severity;
}

export interface Inspection {
  id: string;
  createdAt: string;
  label: string;
  fileCount: number;
  results: PairResult[];
}
