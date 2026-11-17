import { canvasToBlob, makeCanvas } from '../../src/core/canvas';

export interface MakeJpegOpts {
  w: number; h: number;
  fill?: string;
  pattern?: 'checker' | 'flat' | 'noise';
  blur?: number;
  lastModified?: number;
  name?: string;
  seed?: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Draw a synthetic photo on a canvas and return it as a JPEG File (no EXIF). */
export async function makeJpeg(o: MakeJpegOpts): Promise<File> {
  const c = makeCanvas(o.w, o.h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = o.fill ?? '#808080';
  ctx.fillRect(0, 0, o.w, o.h);
  if (o.pattern === 'checker') {
    const s = Math.max(4, Math.round(o.w / 64));
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < o.h; y += s) for (let x = (y / s) % 2 ? s : 0; x < o.w; x += 2 * s) ctx.fillRect(x, y, s, s);
  } else if (o.pattern === 'noise') {
    const r = rng(o.seed ?? 7);
    const img = ctx.getImageData(0, 0, o.w, o.h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 256);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }
  let out: HTMLCanvasElement = c;
  if (o.blur) {
    const b = makeCanvas(o.w, o.h);
    const bctx = b.getContext('2d')!;
    bctx.filter = `blur(${o.blur}px)`;
    bctx.drawImage(c, 0, 0);
    out = b;
  }
  const blob = await canvasToBlob(out, 'image/jpeg', 0.92);
  return new File([blob], o.name ?? 'test.jpg', { type: 'image/jpeg', lastModified: o.lastModified ?? Date.now() });
}
