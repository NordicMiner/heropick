import { expect, test } from 'vitest';
import { groupBursts } from '../../src/core/bursts';

const H0 = '0000000000000000';
const H1 = '0000000000000003'; // 2 bits from H0
const FAR = 'ffffffffff000000'; // 40 bits from H0

const p = (id: string, takenAt: number, hash: string, order = 0) => ({ id, takenAt, hash, order });

test('photos 300 ms apart with similar hashes form one burst', () => {
  const m = groupBursts([p('a', 1000, H0, 0), p('b', 1300, H1, 1), p('c', 1600, H0, 2)]);
  expect(new Set(m.values()).size).toBe(1);
});

test('similar photos 10 s apart are separate bursts', () => {
  const m = groupBursts([p('a', 1000, H0, 0), p('b', 11000, H0, 1)]);
  expect(m.get('a')).not.toBe(m.get('b'));
});

test('close in time but visually different are separate bursts', () => {
  const m = groupBursts([p('a', 1000, H0, 0), p('b', 1300, FAR, 1)]);
  expect(m.get('a')).not.toBe(m.get('b'));
});

test('without capture times, near-identical neighbours still group', () => {
  const m = groupBursts([p('a', 0, H0, 0), p('b', 1, H1, 1), p('c', 2, FAR, 2)]);
  expect(m.get('a')).toBe(m.get('b'));
  expect(m.get('c')).not.toBe(m.get('a'));
});

test('missing capture times: far-apart pick order does not split a visual burst', () => {
  // takenAt === order (no EXIF/lastModified); order gap 5 > maxGapMs would not matter
  const m = groupBursts([p('a', 0, H0, 0), p('b', 1, H1, 1)], { maxGapMs: 0 });
  expect(m.get('a')).toBe(m.get('b'));
});

test('every photo gets a burst id', () => {
  const photos = [p('a', 1, H0, 0), p('b', 5000, FAR, 1), p('c', 9000, H0, 2)];
  const m = groupBursts(photos);
  for (const x of photos) expect(m.has(x.id)).toBe(true);
});

test('a burst that drifts slowly stays one burst', () => {
  // each frame is 8 bits from the previous one, but the last is 16 bits from the first
  const m = groupBursts([p('a', 0, '0000000000000000', 0), p('b', 300, '00000000000000ff', 1), p('c', 600, '000000000000ffff', 2)]);
  expect(new Set(m.values()).size).toBe(1);
});

test('a long continuous sequence (a speech) is split into short moments', () => {
  // 60 frames 1.5 s apart, each 1 bit from the previous: every frame "matches" its neighbour.
  const frames = Array.from({ length: 60 }, (_, i) => {
    const bits = BigInt(2) ** BigInt(i % 64) - BigInt(1);
    return p(`f${i}`, i * 1500, bits.toString(16).padStart(16, '0').slice(-16), i);
  });
  const m = groupBursts(frames);
  expect(new Set(m.values()).size).toBeGreaterThanOrEqual(15);
});
