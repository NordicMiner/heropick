import { swapCandidates } from '../core/heroes';
import type { ShootResult } from '../core/pipeline';
import type { Session } from '../core/session';
import { NO_EDIT, type Edit } from '../core/types';

export const MIN_N = 4;
export const MAX_N = 10;
const SWAP_SHOWN = 12;

export function editFor(s: Session, id: string): Edit {
  return s.edits.perPhoto[id] ?? s.edits.all;
}

/**
 * Original files to keep on the phone so everything still works after a reload:
 * the heroes, every slot's swap options, and the next photo "More" would add.
 */
export function keepOriginals(result: ShootResult, mem: Map<string, File>, existing: Map<string, Blob>): Map<string, Blob> {
  const want = new Set(result.heroIds);
  for (let slot = 0; slot < result.heroIds.length; slot++) {
    for (const id of swapCandidates(result.scored, result.heroIds, slot, SWAP_SHOWN)) want.add(id);
  }
  for (const id of swapCandidates(result.scored, result.heroIds, -1, 1)) want.add(id);
  const out = new Map<string, Blob>();
  for (const id of want) {
    const blob = mem.get(id) ?? existing.get(id);
    if (blob) out.set(id, blob);
  }
  return out;
}

export function newSession(result: ShootResult, mem: Map<string, File>): Session {
  return { result, edits: { all: { ...NO_EDIT }, perPhoto: {} }, originals: keepOriginals(result, mem, new Map()), savedAt: Date.now() };
}

const hasOriginal = (s: Session, mem: Map<string, File>, id: string) => mem.has(id) || s.originals.has(id);

/** Swap options for a slot that we can actually export (original still available). */
export function swapOptions(s: Session, mem: Map<string, File>, slot: number): string[] {
  return swapCandidates(s.result.scored, s.result.heroIds, slot, 40).filter((id) => hasOriginal(s, mem, id)).slice(0, SWAP_SHOWN);
}

export function withHeroes(s: Session, mem: Map<string, File>, heroIds: string[]): Session {
  const result = { ...s.result, heroIds, n: heroIds.length };
  return { ...s, result, originals: keepOriginals(result, mem, s.originals), savedAt: Date.now() };
}

export function swap(s: Session, mem: Map<string, File>, slot: number, id: string): Session {
  const heroIds = [...s.result.heroIds];
  heroIds[slot] = id;
  return withHeroes(s, mem, heroIds);
}

/** Add the best photo from a burst not already in the set. */
export function more(s: Session, mem: Map<string, File>): Session {
  if (s.result.heroIds.length >= MAX_N) return s;
  const next = swapCandidates(s.result.scored, s.result.heroIds, -1, 40).find((id) => hasOriginal(s, mem, id));
  return next ? withHeroes(s, mem, [...s.result.heroIds, next]) : s;
}

export function fewer(s: Session, mem: Map<string, File>): Session {
  if (s.result.heroIds.length <= MIN_N) return s;
  return withHeroes(s, mem, s.result.heroIds.slice(0, -1));
}

export function canMore(s: Session, mem: Map<string, File>): boolean {
  return s.result.heroIds.length < MAX_N && swapCandidates(s.result.scored, s.result.heroIds, -1, 40).some((id) => hasOriginal(s, mem, id));
}

export function originalOf(s: Session, mem: Map<string, File>, id: string): Blob | undefined {
  return mem.get(id) ?? s.originals.get(id);
}

export function nameOf(s: Session, id: string): string {
  return s.result.photos.find((p) => p.id === id)?.name ?? 'photo.jpg';
}
