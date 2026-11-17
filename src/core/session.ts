import { del, get, keys, set } from 'idb-keyval';
import type { ShootResult } from './pipeline';
import type { Edit } from './types';

export interface Session {
  result: ShootResult;
  edits: { all: Edit; perPhoto: Record<string, Edit> };
  /** Original files for the current heroes + their swap options only. */
  originals: Map<string, Blob>;
  savedAt: number;
}

// Storage layout (IndexedDB):
//   hp:session      small record: picks, scores, edits, which originals exist — rewritten on every tap
//   hp:thumbs       all thumbnails — written once per shoot
//   hp:orig:<id>    one original photo each — written once, deleted when no longer needed
const KEY = 'hp:session';
const THUMBS = 'hp:thumbs';
const ORIG = 'hp:orig:';

// Blobs are stored as ArrayBuffers: older iOS Safari versions were unreliable with Blobs in IndexedDB.
type StoredBlob = { type: string; buf: ArrayBuffer };
interface Stored {
  result: Omit<ShootResult, 'thumbs'>;
  edits: Session['edits'];
  originalIds: string[];
  savedAt: number;
}

const pack = async (b: Blob): Promise<StoredBlob> => ({ type: b.type, buf: await b.arrayBuffer() });
const unpack = (s: StoredBlob) => new Blob([s.buf], { type: s.type });

// What this page has already written, so unchanged photos are never copied again.
let storedThumbs: Map<string, Blob> | null = null;
const storedOriginals = new Map<string, Blob>();
let askedPersist = false;

async function write(s: Session): Promise<void> {
  // 1. New originals first, so the record never points at a photo that isn't there.
  for (const [id, blob] of s.originals) {
    if (storedOriginals.get(id) !== blob) {
      await set(ORIG + id, await pack(blob));
      storedOriginals.set(id, blob);
    }
  }
  // 2. Thumbnails once per shoot.
  if (storedThumbs !== s.result.thumbs) {
    const packed: [string, StoredBlob][] = [];
    for (const [id, b] of s.result.thumbs) packed.push([id, await pack(b)]);
    await set(THUMBS, packed);
    storedThumbs = s.result.thumbs;
  }
  // 3. The small record.
  const { thumbs: _thumbs, ...result } = s.result;
  const stored: Stored = { result, edits: s.edits, originalIds: [...s.originals.keys()], savedAt: s.savedAt };
  await set(KEY, stored);
  // 4. Drop originals no longer needed (including leftovers from an earlier shoot).
  for (const k of await keys()) {
    if (typeof k === 'string' && k.startsWith(ORIG) && !s.originals.has(k.slice(ORIG.length))) {
      await del(k);
      storedOriginals.delete(k.slice(ORIG.length));
    }
  }
  if (!askedPersist) {
    askedPersist = true;
    navigator.storage?.persist?.().catch(() => {});
  }
}

// Saves run one at a time; a burst of taps collapses to the latest state.
let chain: Promise<void> = Promise.resolve();
let pending: Session | null = null;

/** Queue a save. Resolves once this state (or a newer one) is stored; rejects if storing fails. */
export function saveSession(s: Session): Promise<void> {
  pending = s;
  const run = chain.then(async () => {
    const cur = pending;
    pending = null;
    if (cur) await write(cur);
  });
  chain = run.catch(() => {});
  return run;
}

/** Wait until every queued save has finished. */
export function flushSaves(): Promise<void> {
  return chain;
}

export async function loadSession(): Promise<Session | null> {
  await chain;
  const s = (await get(KEY)) as Stored | undefined;
  if (!s) return null;
  const thumbsPacked = ((await get(THUMBS)) as [string, StoredBlob][] | undefined) ?? [];
  const thumbs = new Map(thumbsPacked.map(([id, b]) => [id, unpack(b)]));
  const originals = new Map<string, Blob>();
  for (const id of s.originalIds) {
    const b = (await get(ORIG + id)) as StoredBlob | undefined;
    if (b) originals.set(id, unpack(b));
  }
  storedThumbs = thumbs;
  storedOriginals.clear();
  for (const [id, b] of originals) storedOriginals.set(id, b);
  return { result: { ...s.result, thumbs, facesFailed: s.result.facesFailed ?? false }, edits: s.edits, originals, savedAt: s.savedAt };
}

export function clearSession(): Promise<void> {
  pending = null;
  const run = chain.then(async () => {
    for (const k of await keys()) if (typeof k === 'string' && (k === KEY || k === THUMBS || k.startsWith(ORIG))) await del(k);
    storedThumbs = null;
    storedOriginals.clear();
  });
  chain = run.catch(() => {});
  return run;
}
