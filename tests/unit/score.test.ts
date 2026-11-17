import { expect, test } from 'vitest';
import { PROFILES } from '../../src/core/profiles';
import { scoreShoot } from '../../src/core/score';
import { findMainPerson } from '../../src/core/people';
import type { PhotoMetrics } from '../../src/core/types';
import { face, near, unitVec } from '../helpers/faces';
import { metrics } from '../helpers/metrics';

const VIP = unitVec(100);

/** A shoot with a spread of sharpness so percentiles mean something. */
function shoot(extra: PhotoMetrics[]) {
  const filler = Array.from({ length: 8 }, (_, i) =>
    metrics({ id: `f${i}`, sharpSubject: 50 + i * 20, sharpGlobal: 50 + i * 20, faces: [face(near(VIP, 10 + i), 0.12)] }));
  const photos = [...filler, ...extra];
  const bursts = new Map(photos.map((p, i) => [p.id, i]));
  return { photos, bursts, person: findMainPerson(photos) };
}

const byId = <T extends { id: string }>(s: T[], id: string) => s.find((x) => x.id === id)!;

test('sharp, eyes-open main person beats the same photo blurred', () => {
  const sharp = metrics({ id: 'sharp', sharpSubject: 2000, sharpGlobal: 2000, faces: [face(near(VIP, 1), 0.15)] });
  const soft = metrics({ id: 'soft', sharpSubject: 1, sharpGlobal: 1, faces: [face(near(VIP, 2), 0.15)] });
  const { photos, bursts, person } = shoot([sharp, soft]);
  const s = scoreShoot(photos, bursts, person, PROFILES.government);
  expect(byId(s, 'sharp').score).toBeGreaterThan(byId(s, 'soft').score);
  expect(byId(s, 'soft').flags).toContain('blurry');
});

test('closed eyes are flagged and score lower', () => {
  const open = metrics({ id: 'open', faces: [face(near(VIP, 1), 0.15)] });
  const shut = metrics({ id: 'shut', faces: [face(near(VIP, 2), 0.15, {}, { eyesOpen: 0.1 })] });
  const { photos, bursts, person } = shoot([open, shut]);
  const s = scoreShoot(photos, bursts, person, PROFILES.government);
  expect(byId(s, 'shut').score).toBeLessThan(byId(s, 'open').score);
  expect(byId(s, 'shut').flags).toContain('eyesClosed');
});

test('band profile does not flag dark stage shots; government does', () => {
  const dark = metrics({ id: 'dark', exposure: { mean: 0.08, clipHigh: 0, clipLow: 0.3 }, faces: [face(near(VIP, 1), 0.15)] });
  const { photos, bursts, person } = shoot([dark]);
  expect(byId(scoreShoot(photos, bursts, person, PROFILES.band), 'dark').flags).not.toContain('dark');
  expect(byId(scoreShoot(photos, bursts, person, PROFILES.government), 'dark').flags).toContain('dark');
});

test('a shoot with no faces still gets spread-out scores', () => {
  const photos = Array.from({ length: 10 }, (_, i) => metrics({ id: `n${i}`, sharpSubject: 10 + i * 100, sharpGlobal: 10 + i * 100 }));
  const bursts = new Map(photos.map((p, i) => [p.id, i]));
  const s = scoreShoot(photos, bursts, null, PROFILES.government);
  const scores = s.map((x) => x.score);
  expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThanOrEqual(20);
  for (const x of s) expect(x.shot).toBe('other');
});

test('scores stay within 0–100 and carry burst ids', () => {
  const { photos, bursts, person } = shoot([]);
  for (const x of scoreShoot(photos, bursts, person, PROFILES.soccer)) {
    expect(x.score).toBeGreaterThanOrEqual(0);
    expect(x.score).toBeLessThanOrEqual(100);
    expect(x.burstId).toBe(bursts.get(x.id));
  }
});

test('"dark" is judged against the rest of the shoot (a stage event is dark overall)', () => {
  // Every photo is stage-dark (mean 0.10–0.20); one at 0.11 is normal here, not "dark".
  const photos = Array.from({ length: 10 }, (_, i) => metrics({ id: `s${i}`, exposure: { mean: 0.1 + i * 0.01, clipHigh: 0, clipLow: 0.3 }, faces: [face(near(VIP, i + 1), 0.12)] }));
  const bursts = new Map(photos.map((p, i) => [p.id, i]));
  const s = scoreShoot(photos, bursts, findMainPerson(photos), PROFILES.government);
  expect(byId(s, 's1').flags).not.toContain('dark');
});

test('a photo much darker than the rest of the shoot is still "dark"', () => {
  const photos = Array.from({ length: 10 }, (_, i) => metrics({ id: `d${i}`, exposure: { mean: 0.4, clipHigh: 0, clipLow: 0 }, faces: [face(near(VIP, i + 1), 0.12)] }));
  photos.push(metrics({ id: 'night', exposure: { mean: 0.1, clipHigh: 0, clipLow: 0.6 }, faces: [face(near(VIP, 40), 0.12)] }));
  const bursts = new Map(photos.map((p, i) => [p.id, i]));
  const s = scoreShoot(photos, bursts, findMainPerson(photos), PROFILES.government);
  expect(byId(s, 'night').flags).toContain('dark');
});

test('eyes are only judged on faces big enough to read (small faces looking down are not "eyes closed")', () => {
  const small = metrics({ id: 'small', faces: [face(near(VIP, 1), 0.06, {}, { eyesOpen: 0.1 })] });
  const big = metrics({ id: 'big', faces: [face(near(VIP, 2), 0.15, {}, { eyesOpen: 0.1 })] });
  const { photos, bursts, person } = shoot([small, big]);
  const s = scoreShoot(photos, bursts, person, PROFILES.government);
  expect(byId(s, 'small').flags).not.toContain('eyesClosed');
  expect(byId(s, 'big').flags).toContain('eyesClosed');
});
