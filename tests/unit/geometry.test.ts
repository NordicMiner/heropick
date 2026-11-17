import { expect, test } from 'vitest';
import { eyeAspectRatio, eyesOpenScore, mouthOpenScore } from '../../src/faces/geometry';

type P = { x: number; y: number };
/** Six eye points (dlib order) whose EAR is exactly `ear` (eye width 1). */
const eye = (ear: number): P[] => [
  { x: 0, y: 0 }, { x: 0.33, y: -ear / 2 }, { x: 0.66, y: -ear / 2 },
  { x: 1, y: 0 }, { x: 0.66, y: ear / 2 }, { x: 0.33, y: ear / 2 },
];

/** 68 points, all zero except the inner lips (60–67) with a vertical gap. */
function lips(gap: number): P[] {
  const pts: P[] = Array.from({ length: 68 }, () => ({ x: 0, y: 0 }));
  pts[60] = { x: 0, y: 0 }; pts[64] = { x: 10, y: 0 };
  pts[61] = { x: 3, y: -gap / 2 }; pts[62] = { x: 5, y: -gap / 2 }; pts[63] = { x: 7, y: -gap / 2 };
  pts[67] = { x: 3, y: gap / 2 }; pts[66] = { x: 5, y: gap / 2 }; pts[65] = { x: 7, y: gap / 2 };
  return pts;
}

test('eyeAspectRatio matches the construction', () => {
  expect(eyeAspectRatio(eye(0.3))).toBeCloseTo(0.3, 5);
});

test('open eyes score 1', () => {
  expect(eyesOpenScore(eye(0.3), eye(0.3))).toBe(1);
});

test('closed eyes score 0', () => {
  expect(eyesOpenScore(eye(0.1), eye(0.3))).toBe(0);
});

test('mouth gap of 8% of face height scores 1, closed scores 0', () => {
  expect(mouthOpenScore(lips(8), 100)).toBeCloseTo(1, 5);
  expect(mouthOpenScore(lips(0), 100)).toBe(0);
});
