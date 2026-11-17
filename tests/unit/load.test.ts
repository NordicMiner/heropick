import { expect, test } from 'vitest';
import { loadPhoto, UnreadablePhotoError } from '../../src/core/load';
import { makeJpeg } from '../helpers/makeJpeg';
import { canvasToBlob, makeCanvas } from '../../src/core/canvas';

test('downscales to maxEdge', async () => {
  const f = await makeJpeg({ w: 3000, h: 2000, pattern: 'checker' });
  const p = await loadPhoto(f, 0);
  expect(p.analysis.width).toBe(1024);
  expect(p.analysis.height).toBe(683);
  expect(p.width).toBe(3000);
  expect(p.height).toBe(2000);
  p.bitmap.close();
});

test('falls back to lastModified when no EXIF', async () => {
  const f = await makeJpeg({ w: 200, h: 100, lastModified: 1700000000000 });
  const p = await loadPhoto(f, 3);
  expect(p.takenAt).toBe(1700000000000);
  expect(p.order).toBe(3);
  p.bitmap.close();
});

test('thumb is a JPEG no bigger than 320px', async () => {
  const f = await makeJpeg({ w: 2000, h: 1500 });
  const p = await loadPhoto(f, 0);
  expect(p.thumb.type).toBe('image/jpeg');
  const b = await createImageBitmap(p.thumb);
  expect(Math.max(b.width, b.height)).toBeLessThanOrEqual(320);
  expect(Math.max(b.width, b.height)).toBeGreaterThanOrEqual(319);
  p.bitmap.close();
});

test('rejects garbage with UnreadablePhotoError', async () => {
  const f = new File([new Uint8Array([1, 2, 3])], 'x.jpg', { type: 'image/jpeg' });
  await expect(loadPhoto(f, 0)).rejects.toBeInstanceOf(UnreadablePhotoError);
});

test('id is stable for the same file identity', async () => {
  const a = await makeJpeg({ w: 100, h: 100, lastModified: 5, name: 'a.jpg' });
  const p1 = await loadPhoto(a, 0);
  const p2 = await loadPhoto(a, 9);
  expect(p1.id).toBe(p2.id);
  expect(p1.id).toBe(`a.jpg|${a.size}|5`);
  p1.bitmap.close(); p2.bitmap.close();
});

test('screenshots (PNG) and GIFs are skipped', async () => {
  const c = makeCanvas(100, 100);
  const png = await canvasToBlob(c, 'image/png');
  await expect(loadPhoto(new File([png], 'IMG_0001.PNG', { type: 'image/png' }), 0)).rejects.toBeInstanceOf(UnreadablePhotoError);
  await expect(loadPhoto(new File([png], 'anim.gif', { type: 'image/gif' }), 0)).rejects.toBeInstanceOf(UnreadablePhotoError);
});

test('loading a photo releases the canvases it used', async () => {
  const made: HTMLCanvasElement[] = [];
  const orig = document.createElement.bind(document);
  document.createElement = ((tag: string, o?: ElementCreationOptions) => {
    const el = orig(tag, o);
    if (tag === 'canvas') made.push(el as HTMLCanvasElement);
    return el;
  }) as typeof document.createElement;
  try {
    const f = await makeJpeg({ w: 1600, h: 1200 });
    made.length = 0;
    const p = await loadPhoto(f, 0);
    p.bitmap.close();
  } finally {
    document.createElement = orig as typeof document.createElement;
  }
  expect(made.length).toBeGreaterThan(0);
  for (const c of made) expect(c.width * c.height).toBe(0);
});
