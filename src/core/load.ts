import exifr from 'exifr';
import { canvasToBlob, makeCanvas } from './canvas';

export class UnreadablePhotoError extends Error {
  constructor(public fileName: string, cause?: unknown) {
    super(`Couldn't read ${fileName}`);
    this.name = 'UnreadablePhotoError';
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

export interface LoadedPhoto {
  id: string;
  name: string;
  takenAt: number;
  order: number;
  width: number;
  height: number;
  analysis: ImageData;
  /** ≤ maxEdge decode for the face model. Caller must close(). */
  bitmap: ImageBitmap;
  /** 320 px long-edge JPEG. */
  thumb: Blob;
}

export function photoId(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function fit(w: number, h: number, maxEdge: number) {
  const s = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

function drawScaled(src: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

async function readTakenAt(file: File): Promise<number | null> {
  try {
    const exif = await exifr.parse(file, { pick: ['DateTimeOriginal'] });
    const d = exif?.DateTimeOriginal;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
  } catch {
    /* no EXIF — fall through */
  }
  return null;
}

/** Screenshots and GIFs are not event photos. */
const NOT_PHOTO = /^image\/(png|gif)$|\.(png|gif)$/i;

/** Free a canvas's pixel memory now (iOS caps total canvas memory). */
export function releaseCanvas(c: HTMLCanvasElement): void {
  c.width = 0;
  c.height = 0;
}

export async function loadPhoto(file: File, order: number, maxEdge = 1024): Promise<LoadedPhoto> {
  if (NOT_PHOTO.test(file.type) || NOT_PHOTO.test(file.name)) throw new UnreadablePhotoError(file.name);
  let full: ImageBitmap;
  try {
    full = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    throw new UnreadablePhotoError(file.name, e);
  }
  try {
    const width = full.width;
    const height = full.height;
    const a = fit(width, height, maxEdge);
    const analysisCanvas = drawScaled(full, a.w, a.h);
    const t = fit(width, height, 320);
    const thumbCanvas = drawScaled(full, t.w, t.h);
    const analysis = analysisCanvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, a.w, a.h);
    const [bitmap, thumb, exifTime] = await Promise.all([
      createImageBitmap(analysisCanvas),
      canvasToBlob(thumbCanvas, 'image/jpeg', 0.8),
      readTakenAt(file),
    ]);
    releaseCanvas(analysisCanvas);
    releaseCanvas(thumbCanvas);
    const takenAt = exifTime ?? (file.lastModified || order);
    return { id: photoId(file), name: file.name, takenAt, order, width, height, analysis, bitmap, thumb };
  } finally {
    full.close();
  }
}
