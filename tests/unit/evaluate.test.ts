import { expect, test } from 'vitest';
import { evaluateShoot } from '../../src/tune/evaluate';
import { fromJson, toJson } from '../../src/tune/serialize';
import { metrics } from '../helpers/metrics';
import { face, near, unitVec } from '../helpers/faces';

const VIP = unitVec(100);

function shoot() {
  // 8 separate moments; photo k is sharper for higher k. Moment 7 has a near-identical sibling.
  const photos = Array.from({ length: 8 }, (_, k) =>
    metrics({ id: `id${k}`, name: `P${k}.JPG`, takenAt: k * 60_000, order: k, hash: k.toString(16).padStart(2, '0').repeat(8),
      sharpSubject: 10 + k * 100, sharpGlobal: 10 + k * 100, faces: [face(near(VIP, k + 1), 0.15)] }));
  photos.push(metrics({ id: 'id7b', name: 'P7b.JPG', takenAt: 7 * 60_000 + 500, order: 8, hash: photos[7].hash,
    sharpSubject: 5, sharpGlobal: 5, faces: [face(near(VIP, 30), 0.15)] }));
  return photos;
}

test('overlap counts heroes that match a picked photo', () => {
  const r = evaluateShoot(shoot(), 'government', ['P7.JPG', 'P6.JPG', 'P0.JPG'], 6);
  expect(r.heroNames).toHaveLength(6);
  expect(r.overlap).toBe(2); // P7 and P6 are among the sharpest; P0 is the blurriest
  expect(r.missed.map((m) => m.name)).toEqual(['P0.JPG']);
  expect(r.missed[0].flags).toContain('blurry');
});

test('a sibling frame from the same burst counts as agreement', () => {
  const r = evaluateShoot(shoot(), 'government', ['P7b.JPG'], 6);
  expect(r.heroNames).toContain('P7.JPG');
  expect(r.overlap).toBe(1);
});

test('unknown picked names are reported, not counted', () => {
  const r = evaluateShoot(shoot(), 'government', ['NOPE.JPG'], 6);
  expect(r.overlap).toBe(0);
  expect(r.unknown).toEqual(['NOPE.JPG']);
});

test('metrics survive a JSON round trip, descriptors included', () => {
  const photos = shoot();
  const back = fromJson(JSON.parse(JSON.stringify(toJson(photos))));
  expect(back).toHaveLength(photos.length);
  expect(back[0].faces[0].descriptor).toBeInstanceOf(Float32Array);
  expect(Array.from(back[0].faces[0].descriptor)).toEqual(Array.from(photos[0].faces[0].descriptor));
  expect(back[3].hash).toBe(photos[3].hash);
});
