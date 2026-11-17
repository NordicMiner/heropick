import type { ExposureStats, Rect } from './types';

/** Rec.709 luma, 0–1. */
export function toGray(img: ImageData): Float32Array {
  const { data } = img;
  const n = img.width * img.height;
  const g = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    g[i] = (0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2]) / 255;
  }
  return g;
}

/** Variance of the 4-neighbour Laplacian inside rect (normalized coords, clamped). */
export function sharpness(gray: Float32Array, w: number, h: number, rect?: Rect): number {
  let x0 = 1, y0 = 1, x1 = w - 1, y1 = h - 1;
  if (rect) {
    x0 = Math.max(1, Math.floor(rect.x * w));
    y0 = Math.max(1, Math.floor(rect.y * h));
    x1 = Math.min(w - 1, Math.ceil((rect.x + rect.w) * w));
    y1 = Math.min(h - 1, Math.ceil((rect.y + rect.h) * h));
  }
  let sum = 0, sum2 = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * w;
    for (let x = x0; x < x1; x++) {
      const i = row + x;
      const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      sum += l; sum2 += l * l; n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.max(0, sum2 / n - mean * mean);
}

export function exposureStats(img: ImageData): ExposureStats {
  const g = toGray(img);
  let sum = 0, hi = 0, lo = 0;
  for (let i = 0; i < g.length; i++) {
    const v = g[i];
    sum += v;
    if (v >= 0.98) hi++;
    if (v <= 0.02) lo++;
  }
  const n = g.length || 1;
  return { mean: sum / n, clipHigh: hi / n, clipLow: lo / n };
}

/** 64-bit difference hash: 9×8 area-averaged grid, compare horizontal neighbours. 16 hex chars. */
export function dHash(gray: Float32Array, w: number, h: number): string {
  const gw = 9, gh = 8;
  const cells = new Float64Array(gw * gh);
  for (let cy = 0; cy < gh; cy++) {
    const ya = Math.floor((cy * h) / gh), yb = Math.max(ya + 1, Math.floor(((cy + 1) * h) / gh));
    for (let cx = 0; cx < gw; cx++) {
      const xa = Math.floor((cx * w) / gw), xb = Math.max(xa + 1, Math.floor(((cx + 1) * w) / gw));
      let s = 0, n = 0;
      for (let y = ya; y < yb && y < h; y++) for (let x = xa; x < xb && x < w; x++) { s += gray[y * w + x]; n++; }
      cells[cy * gw + cx] = n ? s / n : 0;
    }
  }
  let hex = '';
  for (let cy = 0; cy < gh; cy++) {
    let byte = 0;
    for (let cx = 0; cx < 8; cx++) {
      byte = (byte << 1) | (cells[cy * gw + cx] > cells[cy * gw + cx + 1] ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

const POP = Array.from({ length: 16 }, (_, i) => (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1));

export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}
