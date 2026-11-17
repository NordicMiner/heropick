import { hamming } from './pixels';
import type { PhotoMetrics } from './types';

type BurstInput = Pick<PhotoMetrics, 'id' | 'takenAt' | 'order' | 'hash'>;

/** Group near-identical consecutive frames. Returns photo id → burst id. */
export function groupBursts(
  photos: BurstInput[],
  opts: { maxGapMs?: number; maxHamming?: number; maxSpanMs?: number } = {},
): Map<string, number> {
  const maxGapMs = opts.maxGapMs ?? 2000;
  const maxHamming = opts.maxHamming ?? 12;
  const maxSpanMs = opts.maxSpanMs ?? 4000;
  const out = new Map<string, number>();
  if (photos.length === 0) return out;

  // No usable capture times: every takenAt is its pick order, or they are all the same.
  const noTimes = photos.every((p) => p.takenAt === p.order) || photos.every((p) => p.takenAt === photos[0].takenAt);
  const sorted = [...photos].sort((a, b) => (noTimes ? a.order - b.order : a.takenAt - b.takenAt || a.order - b.order));

  let burst = 0;
  let prev = sorted[0];
  let first = sorted[0];
  out.set(prev.id, burst);
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i];
    // Compare with the previous frame (not the first), so a burst that drifts slowly stays together.
    // ...but cap how far a burst can wander, so a long speech shot continuously becomes several moments.
    const close = hamming(p.hash, prev.hash) <= maxHamming && hamming(p.hash, first.hash) <= 2 * maxHamming;
    const same = noTimes
      ? close
      : close && p.takenAt - prev.takenAt <= maxGapMs && p.takenAt - first.takenAt <= maxSpanMs;
    if (!same) {
      burst++;
      first = p;
    }
    out.set(p.id, burst);
    prev = p;
  }
  return out;
}
