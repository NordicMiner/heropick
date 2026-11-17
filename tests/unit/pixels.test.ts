import { expect, test } from 'vitest';
import { dHash, exposureStats, hamming, sharpness, toGray } from '../../src/core/pixels';
import { boxBlur, checker, makeImageData, seeded } from '../helpers/imageData';

test('checkerboard is much sharper than the same board blurred', () => {
  const sharp = makeImageData(128, 128, checker(4));
  const soft = boxBlur(sharp, 4);
  const a = sharpness(toGray(sharp), 128, 128);
  const b = sharpness(toGray(soft), 128, 128);
  expect(a).toBeGreaterThan(10 * b);
});

test('rect limits the measured region', () => {
  const img = makeImageData(128, 128, (x, y) => (x < 64 ? checker(4)(x, y) : 128));
  const g = toGray(img);
  const left = sharpness(g, 128, 128, { x: 0, y: 0, w: 0.5, h: 1 });
  const right = sharpness(g, 128, 128, { x: 0.5, y: 0, w: 0.5, h: 1 });
  expect(left).toBeGreaterThan(10 * Math.max(right, 1e-9));
});

test('rect outside the image is clamped, not a crash', () => {
  const g = toGray(makeImageData(32, 32, checker(2)));
  expect(Number.isFinite(sharpness(g, 32, 32, { x: 0.9, y: 0.9, w: 0.5, h: 0.5 }))).toBe(true);
});

test('all white and all black exposure', () => {
  const white = exposureStats(makeImageData(16, 16, () => 255));
  expect(white.clipHigh).toBe(1);
  expect(white.mean).toBeCloseTo(1, 2);
  const black = exposureStats(makeImageData(16, 16, () => 0));
  expect(black.clipLow).toBe(1);
  expect(black.mean).toBeCloseTo(0, 2);
});

test('dHash survives a small brightness change', () => {
  const r = seeded(3);
  const base = makeImageData(64, 64, (x, y) => Math.round(100 + 80 * Math.sin(x / 7) * Math.cos(y / 9) + r() * 4));
  const brighter = makeImageData(64, 64, (x, y) => Math.min(255, Math.round(base.data[(y * 64 + x) * 4] * 1.05)));
  const a = dHash(toGray(base), 64, 64);
  const b = dHash(toGray(brighter), 64, 64);
  expect(a).toMatch(/^[0-9a-f]{16}$/);
  expect(hamming(a, b)).toBeLessThanOrEqual(4);
});

test('dHash differs for unrelated images', () => {
  const r1 = seeded(1), r2 = seeded(2);
  const a = dHash(toGray(makeImageData(64, 64, () => Math.floor(r1() * 256))), 64, 64);
  const b = dHash(toGray(makeImageData(64, 64, () => Math.floor(r2() * 256))), 64, 64);
  expect(hamming(a, b)).toBeGreaterThanOrEqual(20);
});

test('hamming of all-ones vs all-zeros is 64', () => {
  expect(hamming('ffffffffffffffff', '0000000000000000')).toBe(64);
});
