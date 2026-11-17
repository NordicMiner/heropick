import { describe, expect, test } from 'vitest';
import { PROFILES } from '../../src/core/profiles';
import { pickHeroes, swapCandidates } from '../../src/core/heroes';
import type { Flag, Scored, ShotType } from '../../src/core/types';
import { unitVec } from '../helpers/faces';

const s = (id: string, score: number, shot: ShotType, burstId: number, flags: Flag[] = []): Scored => ({ id, score, shot, burstId, flags });

/** 20 bursts: 3 wide, 3 interaction, 14 close; each burst has a best and a weaker sibling. */
function shoot(): Scored[] {
  const out: Scored[] = [];
  for (let b = 0; b < 20; b++) {
    const shot: ShotType = b < 3 ? 'wide' : b < 6 ? 'interaction' : 'close';
    out.push(s(`b${b}a`, 90 - b, shot, b), s(`b${b}b`, 50 - b, shot, b));
  }
  return out;
}

const shotsOf = (all: Scored[], ids: string[]) => ids.map((id) => all.find((x) => x.id === id)!);

test('n=6 government: 2 wide, 1 interaction, 3 close, no repeated burst', () => {
  const all = shoot();
  const h = shotsOf(all, pickHeroes(all, PROFILES.government, 6));
  expect(h.length).toBe(6);
  expect(h.filter((x) => x.shot === 'wide').length).toBe(2);
  expect(h.filter((x) => x.shot === 'interaction').length).toBe(1);
  expect(h.filter((x) => x.shot === 'close').length).toBe(3);
  expect(new Set(h.map((x) => x.burstId)).size).toBe(6);
});

test('n=8 government: 3 wide and 2 interaction', () => {
  const all = shoot();
  const h = shotsOf(all, pickHeroes(all, PROFILES.government, 8));
  expect(h.filter((x) => x.shot === 'wide').length).toBe(3);
  expect(h.filter((x) => x.shot === 'interaction').length).toBe(2);
});

test('result is ordered by score, best first', () => {
  const all = shoot();
  const h = shotsOf(all, pickHeroes(all, PROFILES.government, 6));
  for (let i = 1; i < h.length; i++) expect(h[i - 1].score).toBeGreaterThanOrEqual(h[i].score);
});

test('only 3 photos gives 3 heroes', () => {
  const all = [s('a', 50, 'close', 0), s('b', 40, 'wide', 1), s('c', 30, 'other', 2)];
  expect(pickHeroes(all, PROFILES.government, 6).length).toBe(3);
});

test('everything flagged blurry still fills the set', () => {
  const all = shoot().map((x) => ({ ...x, flags: ['blurry'] as Flag[] }));
  expect(pickHeroes(all, PROFILES.government, 6).length).toBe(6);
});

test('unflagged photos are preferred over higher-scoring flagged ones', () => {
  const all = [s('flag', 99, 'close', 0, ['eyesClosed']), ...Array.from({ length: 6 }, (_, i) => s(`ok${i}`, 50 - i, 'close', i + 1))];
  expect(pickHeroes(all, PROFILES.government, 6)).not.toContain('flag');
});

test('n is clamped to 4–10', () => {
  const all = shoot();
  expect(pickHeroes(all, PROFILES.government, 2).length).toBe(4);
  expect(pickHeroes(all, PROFILES.government, 15).length).toBe(10);
});

test('swap candidates skip other heroes bursts but allow siblings of the slot', () => {
  const all = shoot();
  const heroes = pickHeroes(all, PROFILES.government, 6);
  const slotBurst = all.find((x) => x.id === heroes[0])!.burstId;
  const otherBursts = new Set(heroes.slice(1).map((id) => all.find((x) => x.id === id)!.burstId));
  const c = shotsOf(all, swapCandidates(all, heroes, 0));
  expect(c.length).toBeGreaterThan(0);
  expect(c.length).toBeLessThanOrEqual(12);
  for (const x of c) {
    expect(heroes).not.toContain(x.id);
    expect(otherBursts.has(x.burstId)).toBe(false);
  }
  // Sibling frames of the slot come first (same moment, maybe a better face), then the rest best-first.
  expect(c[0].burstId).toBe(slotBurst);
  const rest = c.filter((x) => x.burstId !== slotBurst);
  for (let i = 1; i < rest.length; i++) expect(rest[i - 1].score).toBeGreaterThanOrEqual(rest[i].score);
});

test('at most 3 sibling frames lead the swap list', () => {
  const all: Scored[] = [s('h', 90, 'close', 0), ...Array.from({ length: 6 }, (_, i) => s(`sib${i}`, 40 - i, 'close', 0)),
    ...Array.from({ length: 10 }, (_, i) => s(`o${i}`, 80 - i, 'close', i + 1))];
  const c = swapCandidates(all, ['h'], 0);
  expect(c.slice(0, 3)).toEqual(['sib0', 'sib1', 'sib2']);
  expect(c[3]).toBe('o0');
});

test('swap list shows one photo per other moment before extra frames', () => {
  const all: Scored[] = [s('h', 90, 'close', 0),
    ...Array.from({ length: 8 }, (_, i) => s(`big${i}`, 80 - i, 'close', 1)),
    ...Array.from({ length: 5 }, (_, i) => s(`o${i}`, 50 - i, 'close', i + 2))];
  const c = swapCandidates(all, ['h'], 0);
  expect(c.slice(0, 6)).toEqual(['big0', 'o0', 'o1', 'o2', 'o3', 'o4']);
});

test('two photos that look almost the same are not both picked', () => {
  // Same podium angle a few seconds apart: different moments, near-identical look.
  const all: Scored[] = Array.from({ length: 8 }, (_, i) => s(`p${i}`, 90 - i, 'close', i));
  const hashes = new Map(all.map((x, i) => [x.id, i < 2 ? '0000000000000000' : (i * 0x1111).toString(16).padStart(4, '0').repeat(4)]));
  hashes.set('p1', '0000000000000007'); // 3 bits from p0
  const h = pickHeroes(all, PROFILES.government, 6, hashes);
  expect(h).toContain('p0');
  expect(h).not.toContain('p1');
  expect(h).toHaveLength(6);
});

test('look-alikes are still used when nothing else is left', () => {
  const all: Scored[] = Array.from({ length: 4 }, (_, i) => s(`p${i}`, 90 - i, 'close', i));
  const hashes = new Map(all.map((x) => [x.id, '0000000000000000']));
  expect(pickHeroes(all, PROFILES.government, 4, hashes)).toHaveLength(4);
});

describe('same person, same pose', () => {
  const kidA = unitVec(501), kidB = unitVec(502);
  // p0 and p1: same kid, same pose, framing differs a little (20 bits apart: above the plain look-alike limit).
  const base = (): Scored[] => Array.from({ length: 8 }, (_, i) => s(`p${i}`, 90 - i, 'close', i));
  const hashes = new Map<string, string>([
    ['p0', '0000000000000000'], ['p1', '00000000000fffff'],
    ...Array.from({ length: 6 }, (_, i) => [`p${i + 2}`, ((i + 3) * 0x1357).toString(16).padStart(4, 'a').repeat(4)] as [string, string]),
  ]);
  const others = Array.from({ length: 6 }, (_, i) => [`p${i + 2}`, unitVec(600 + i)] as [string, Float32Array]);

  test('the same kid in the same pose is picked once', () => {
    const subjects = new Map<string, Float32Array>([['p0', kidA], ['p1', kidA], ...others]);
    const h = pickHeroes(base(), PROFILES.soccer, 6, hashes, subjects);
    expect(h).toContain('p0');
    expect(h).not.toContain('p1');
  });

  test('two different kids in the same pose are both allowed', () => {
    const subjects = new Map<string, Float32Array>([['p0', kidA], ['p1', kidB], ...others]);
    expect(pickHeroes(base(), PROFILES.soccer, 6, hashes, subjects)).toContain('p1');
  });

  test('the same person in a different scene is allowed (e.g. the Premier, a wedding couple)', () => {
    const far = new Map(hashes); far.set('p1', 'ffffffffff000000'); // 40 bits: a different scene
    const subjects = new Map<string, Float32Array>([['p0', kidA], ['p1', kidA], ...others]);
    expect(pickHeroes(base(), PROFILES.soccer, 6, far, subjects)).toContain('p1');
  });
});
