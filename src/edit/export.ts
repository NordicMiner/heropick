import { canvasToBlob } from '../core/canvas';
import type { Edit } from '../core/types';
import type { Lut } from './cube';
import { render } from './render';

export type ExportMode = 2048 | 'full';
export const MAX_PIXELS = 16_000_000; // iOS canvas limit

export function exportSize(w: number, h: number, mode: ExportMode): { w: number; h: number } {
  let s = 1;
  if (mode === 2048) s = Math.min(1, 2048 / Math.max(w, h));
  else if (w * h > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (w * h));
  let ow = Math.round(w * s), oh = Math.round(h * s);
  while (ow * oh > MAX_PIXELS) { ow--; oh = Math.round((ow * h) / w); }
  return { w: Math.max(1, ow), h: Math.max(1, oh) };
}

export const exportName = (name: string) => `${name.replace(/\.[^.]+$/, '')}-hp.jpg`;

/** A new JPEG (quality 0.9) of the original with the edit applied. The original is never changed. */
export async function exportJpeg(original: Blob, name: string, edit: Edit, lut: Lut | null, mode: ExportMode): Promise<File> {
  const bmp = await createImageBitmap(original, { imageOrientation: 'from-image' });
  try {
    const { w, h } = exportSize(bmp.width, bmp.height, mode);
    const canvas = render(bmp, edit, lut, w, h);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    return new File([blob], exportName(name), { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bmp.close();
  }
}
