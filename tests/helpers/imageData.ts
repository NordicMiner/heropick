/** Build ImageData in code: fn(x,y) returns a grey value 0–255 or [r,g,b]. */
export function makeImageData(w: number, h: number, fn: (x: number, y: number) => number | [number, number, number]): ImageData {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y);
    const [r, g, b] = typeof v === 'number' ? [v, v, v] : v;
    const i = (y * w + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  return new ImageData(d, w, h);
}

export const checker = (s: number) => (x: number, y: number) => ((Math.floor(x / s) + Math.floor(y / s)) % 2 ? 255 : 0);

export function boxBlur(img: ImageData, r: number): ImageData {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
      s += data[(yy * w + xx) * 4]; n++;
    }
    const i = (y * w + x) * 4;
    out[i] = out[i + 1] = out[i + 2] = s / n; out[i + 3] = 255;
  }
  return new ImageData(out, w, h);
}

export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
