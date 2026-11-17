import type { Face, PhotoMetrics } from '../../src/core/types';

let n = 0;
export function metrics(over: Partial<PhotoMetrics> & { faces?: Face[] } = {}): PhotoMetrics {
  n++;
  return {
    id: over.id ?? `p${n}`, name: `p${n}.jpg`, takenAt: n * 10_000, order: n, hash: '0000000000000000',
    width: 6000, height: 4000, sharpGlobal: 100, sharpSubject: 100,
    exposure: { mean: 0.45, clipHigh: 0, clipLow: 0 }, faces: [], ...over,
  };
}
