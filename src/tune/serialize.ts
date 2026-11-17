import type { PhotoMetrics } from '../core/types';

type Json = Omit<PhotoMetrics, 'faces'> & { faces: (Omit<PhotoMetrics['faces'][number], 'descriptor'> & { descriptor: number[] })[] };

/** Measured photos → plain JSON (for tuning files kept in the gitignored samples/ folder). */
export function toJson(photos: PhotoMetrics[]): Json[] {
  return photos.map((p) => ({ ...p, faces: p.faces.map((f) => ({ ...f, descriptor: Array.from(f.descriptor) })) }));
}

export function fromJson(data: Json[]): PhotoMetrics[] {
  return data.map((p) => ({ ...p, faces: p.faces.map((f) => ({ ...f, descriptor: Float32Array.from(f.descriptor) })) }));
}
