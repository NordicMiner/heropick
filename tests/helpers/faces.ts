import type { Face, Rect } from '../../src/core/types';
import { seeded } from './imageData';

export function unitVec(seed: number): Float32Array {
  const r = seeded(seed);
  const v = new Float32Array(128);
  let n = 0;
  for (let i = 0; i < 128; i++) { v[i] = r() - 0.5; n += v[i] * v[i]; }
  n = Math.sqrt(n);
  for (let i = 0; i < 128; i++) v[i] /= n;
  return v;
}

/** base + random noise of the given norm. */
export function near(base: Float32Array, seed: number, norm = 0.2): Float32Array {
  const noise = unitVec(seed);
  return base.map((b, i) => b + noise[i] * norm) as Float32Array;
}

export function face(descriptor: Float32Array, h = 0.15, box: Partial<Rect> = {}, extra: Partial<Face> = {}): Face {
  return {
    box: { x: box.x ?? 0.4, y: box.y ?? 0.2, w: box.w ?? h * 0.75, h },
    eyesOpen: 1, happy: 0.5, mouthOpen: 0, descriptor, ...extra,
  };
}
