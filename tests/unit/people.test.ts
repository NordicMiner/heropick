import { expect, test } from 'vitest';
import { classifyShot, findMainPerson, isPerson, topPeople } from '../../src/core/people';
import { face, near, unitVec } from '../helpers/faces';

const VIP = unitVec(100);
const STRANGER = unitVec(200);

function shoot() {
  const photos = [];
  for (let i = 0; i < 5; i++) photos.push({ id: `v${i}`, faces: [face(near(VIP, i + 1))] });
  for (let i = 0; i < 2; i++) photos.push({ id: `s${i}`, faces: [face(near(STRANGER, i + 50))] });
  return photos;
}

test('main person is the face in the most photos', () => {
  const p = findMainPerson(shoot());
  expect(p).not.toBeNull();
  expect(p!.photoIds.sort()).toEqual(['v0', 'v1', 'v2', 'v3', 'v4']);
  expect(isPerson({ ...face(near(VIP, 99)) }, p!)).toBe(true);
  expect(isPerson({ ...face(near(STRANGER, 98)) }, p!)).toBe(false);
});

test('no one in 3 or more photos → no main person', () => {
  const photos = [
    { id: 'a', faces: [face(near(VIP, 1))] },
    { id: 'b', faces: [face(near(VIP, 2))] },
    { id: 'c', faces: [face(near(STRANGER, 3))] },
  ];
  expect(findMainPerson(photos)).toBeNull();
});

test('small background faces are ignored for clustering', () => {
  const photos = [0, 1, 2, 3].map((i) => ({ id: `x${i}`, faces: [face(near(STRANGER, i), 0.03)] }));
  expect(findMainPerson(photos)).toBeNull();
});

test('topPeople is sorted by photo count', () => {
  const t = topPeople(shoot(), 5);
  expect(t.length).toBe(2);
  expect(t[0].photoIds.length).toBe(5);
  expect(t[1].photoIds.length).toBe(2);
});

test('classifyShot rules', () => {
  const person = findMainPerson(shoot());
  expect(classifyShot([face(near(VIP, 7), 0.15)], person)).toBe('close');
  expect(classifyShot([face(near(VIP, 7), 0.09), face(near(STRANGER, 8), 0.09, { x: 0.1 })], person)).toBe('interaction');
  expect(classifyShot(Array.from({ length: 6 }, (_, i) => face(unitVec(300 + i), 0.04)), person)).toBe('wide');
  expect(classifyShot([], person)).toBe('other'); // a photo of trees is not a room shot
  // A person small in a big scene (e.g. on a stage) is a wide shot.
  expect(classifyShot([face(near(VIP, 7), 0.07)], person)).toBe('wide');
});

test('a chain of slightly different faces does not merge into one person', () => {
  // Faces drift 0.3 per step over 6 steps: neighbours look alike, the ends are 1.5 apart (different people).
  const a = unitVec(1);
  const dir = unitVec(2);
  const along = (k: number) => a.map((v, i) => v + dir[i] * 0.3 * k) as Float32Array;
  const photos = [0, 1, 2, 3, 4, 5].flatMap((k) => [0, 1, 2].map((r) => ({ id: `k${k}r${r}`, faces: [face(near(along(k), 10 * k + r, 0.02))] })));
  for (const person of topPeople(photos, 10)) {
    const ks = person.photoIds.map((id) => Number(id[1]));
    expect(Math.max(...ks) - Math.min(...ks)).toBeLessThanOrEqual(1);
  }
});
