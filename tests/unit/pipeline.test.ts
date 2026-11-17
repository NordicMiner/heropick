import { expect, test } from 'vitest';
import { analyzeShoot, rescore } from '../../src/core/pipeline';
import type { Face } from '../../src/core/types';
import { makeJpeg } from '../helpers/makeJpeg';
import { face, near, unitVec } from '../helpers/faces';

const VIP = unitVec(100);
const OTHER = unitVec(200);

/** Stub detector: every photo has the VIP; the first two also have OTHER. */
function stubDetect() {
  let call = 0;
  return async (): Promise<Face[]> => {
    call++;
    const faces = [face(near(VIP, call), 0.15)];
    if (call <= 3) faces.push(face(near(OTHER, call + 50), 0.12, { x: 0.05 }));
    return faces;
  };
}

async function files() {
  const out: File[] = [];
  for (let i = 0; i < 4; i++) {
    out.push(await makeJpeg({ w: 400, h: 300, pattern: 'noise', seed: i + 1, name: `IMG_${i}.jpg`, lastModified: 1_000_000 + i * 60_000 }));
  }
  out.splice(2, 0, new File([new Uint8Array([1, 2, 3])], 'broken.jpg', { type: 'image/jpeg' }));
  return out;
}

test('skips unreadable files, reports progress, picks heroes', async () => {
  const progress: [number, number][] = [];
  const r = await analyzeShoot(await files(), 'government', (d, t) => progress.push([d, t]), { detect: stubDetect() });
  expect(r.skipped).toEqual(['broken.jpg']);
  expect(r.photos.length).toBe(4);
  expect(progress.at(-1)).toEqual([5, 5]);
  const bursts = new Set(r.scored.map((s) => s.burstId)).size;
  expect(r.heroIds.length).toBe(Math.min(6, bursts));
  expect(r.thumbs.size).toBe(4);
  expect(r.n).toBe(6);
  expect(r.person).not.toBeNull();
  for (const p of r.photos) expect(p.hash).toMatch(/^[0-9a-f]{16}$/);
});

test('the same file picked twice is only analysed once', async () => {
  const f = await makeJpeg({ w: 200, h: 200, pattern: 'noise', seed: 9, name: 'dup.jpg', lastModified: 5 });
  const r = await analyzeShoot([f, f], 'government', () => {}, { detect: async () => [] });
  expect(r.photos.length).toBe(1);
});

test('rescore with another person changes scores but not photos', async () => {
  const r = await analyzeShoot(await files(), 'government', () => {}, { detect: stubDetect() });
  const other = { descriptor: OTHER, photoIds: [], faceBox: { photoId: r.photos[0].id, box: { x: 0, y: 0, w: 0.1, h: 0.1 } } };
  const r2 = rescore(r, other, 8);
  expect(r2.photos).toBe(r.photos);
  expect(r2.person).toBe(other);
  expect(r2.n).toBe(8);
  expect(r2.scored.map((s) => s.score)).not.toEqual(r.scored.map((s) => s.score));
});

test('if the face finder breaks partway, the run still finishes without faces for those photos', async () => {
  let call = 0;
  const flaky = async (): Promise<Face[]> => {
    call++;
    if (call >= 2) throw new Error('WebGL context lost');
    return [face(near(VIP, 1), 0.15)];
  };
  const r = await analyzeShoot(await files(), 'government', () => {}, { detect: flaky });
  expect(r.photos.length).toBe(4);
  expect(r.photos[0].faces.length).toBe(1);
  expect(r.photos.slice(1).every((p) => p.faces.length === 0)).toBe(true);
  expect(r.facesFailed).toBe(true);
  expect(r.heroIds.length).toBeGreaterThan(0);
});

test('a normal run reports faces as working', async () => {
  const r = await analyzeShoot(await files(), 'government', () => {}, { detect: stubDetect() });
  expect(r.facesFailed).toBe(false);
});
