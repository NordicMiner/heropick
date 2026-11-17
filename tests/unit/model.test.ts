import { expect, test } from 'vitest';
import type { ShootResult } from '../../src/core/pipeline';
import type { Scored } from '../../src/core/types';
import { NO_EDIT } from '../../src/core/types';
import { canMore, keepOriginals, swapOptions } from '../../src/ui/model';
import type { Session } from '../../src/core/session';
import { metrics } from '../helpers/metrics';

/** 15 moments, 4 frames each: the shape of a real shoot (most top scores are sibling frames). */
function shoot(): { result: ShootResult; mem: Map<string, File> } {
  const scored: Scored[] = [];
  for (let b = 0; b < 15; b++) for (let f = 0; f < 4; f++) scored.push({ id: `b${b}f${f}`, score: 100 - b * 3 - f, flags: [], shot: 'close', burstId: b });
  const photos = scored.map((s) => metrics({ id: s.id }));
  const heroIds = ['b0f0', 'b1f0', 'b2f0', 'b3f0', 'b4f0', 'b5f0'];
  const mem = new Map(scored.map((s) => [s.id, new File([new Uint8Array(4)], `${s.id}.jpg`)]));
  return {
    result: { profileId: 'government', photos, scored, person: null, heroIds, thumbs: new Map(), skipped: [], n: 6, facesFailed: false },
    mem,
  };
}

test('after a reload every slot offers the same swaps as before', () => {
  const { result, mem } = shoot();
  const before: Session = { result, edits: { all: NO_EDIT, perPhoto: {} }, originals: new Map(), savedAt: 0 };
  const kept = keepOriginals(result, mem, new Map());
  const after: Session = { ...before, originals: kept };
  const noMem = new Map<string, File>();
  for (let slot = 0; slot < result.heroIds.length; slot++) {
    expect(swapOptions(after, noMem, slot)).toEqual(swapOptions(before, mem, slot));
  }
  expect(canMore(after, noMem)).toBe(true);
});

test('kept originals stay bounded', () => {
  const { result, mem } = shoot();
  const kept = keepOriginals(result, mem, new Map());
  expect(kept.size).toBeLessThanOrEqual(result.heroIds.length + 12 * result.heroIds.length + 1);
  for (const id of result.heroIds) expect(kept.has(id)).toBe(true);
});
