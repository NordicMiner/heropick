import { expect, test } from 'vitest';
import { exportJpeg, exportSize } from '../../src/edit/export';
import { render } from '../../src/edit/render';
import { getLut } from '../../src/edit/lutStore';
import { NO_EDIT } from '../../src/core/types';
import { makeCanvas } from '../../src/core/canvas';
import { makeJpeg } from '../helpers/makeJpeg';

async function flat(r: number, g: number, b: number): Promise<ImageBitmap> {
  const c = makeCanvas(32, 32);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 32, 32);
  return createImageBitmap(c);
}

function centre(c: HTMLCanvasElement): [number, number, number] {
  const out = makeCanvas(c.width, c.height);
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(c, 0, 0);
  const d = ctx.getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
  return [d[0], d[1], d[2]];
}

const near = (a: number[], b: number[], tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

test('no edit leaves colours unchanged', async () => {
  const px = centre(render(await flat(128, 64, 32), NO_EDIT, null, 32, 32));
  expect(near(px, [128, 64, 32])).toBe(true);
});

test('brightness up makes it brighter', async () => {
  const src = await flat(100, 100, 100);
  const before = centre(render(src, NO_EDIT, null, 32, 32))[0];
  const after = centre(render(src, { ...NO_EDIT, brightness: 0.5 }, null, 32, 32))[0];
  expect(after).toBeGreaterThan(before + 20);
});

test('contrast pushes darks darker and lights lighter', async () => {
  const dark = centre(render(await flat(60, 60, 60), { ...NO_EDIT, contrast: 0.8 }, null, 32, 32))[0];
  const light = centre(render(await flat(190, 190, 190), { ...NO_EDIT, contrast: 0.8 }, null, 32, 32))[0];
  expect(dark).toBeLessThan(55);
  expect(light).toBeGreaterThan(195);
});

test('Mono look at full strength gives equal channels', async () => {
  const mono = await getLut('Mono');
  const [r, g, b] = centre(render(await flat(200, 80, 30), { ...NO_EDIT, lutName: 'Mono', lutStrength: 1 }, mono, 32, 32));
  expect(Math.abs(r - g)).toBeLessThanOrEqual(2);
  expect(Math.abs(g - b)).toBeLessThanOrEqual(2);
});

test('look strength 0 equals no look', async () => {
  const mono = await getLut('Mono');
  const src = await flat(200, 80, 30);
  const none = centre(render(src, NO_EDIT, null, 32, 32));
  const zero = centre(render(src, { ...NO_EDIT, lutName: 'Mono', lutStrength: 0 }, mono, 32, 32));
  expect(near(none, zero)).toBe(true);
});

test('export sizes', () => {
  const full = exportSize(6000, 4000, 'full');
  expect(full.w * full.h).toBeLessThanOrEqual(16_000_000);
  expect(Math.abs(full.w / full.h - 1.5)).toBeLessThan(0.01);
  expect(exportSize(6000, 4000, 2048)).toEqual({ w: 2048, h: 1365 });
  expect(exportSize(4000, 6000, 2048)).toEqual({ w: 1365, h: 2048 });
  expect(exportSize(1000, 800, 2048)).toEqual({ w: 1000, h: 800 });
  expect(exportSize(3000, 2000, 'full')).toEqual({ w: 3000, h: 2000 });
});

test('exportJpeg makes a new JPEG named -hp.jpg at chat size', async () => {
  const original = await makeJpeg({ w: 3000, h: 2000, pattern: 'checker', name: 'IMG_0001.JPG' });
  const f = await exportJpeg(original, 'IMG_0001.JPG', { ...NO_EDIT, brightness: 0.2 }, null, 2048);
  expect(f.type).toBe('image/jpeg');
  expect(f.name).toBe('IMG_0001-hp.jpg');
  const b = await createImageBitmap(f);
  expect([b.width, b.height]).toEqual([2048, 1365]);
});

test('resizing for export releases its temporary canvas', async () => {
  const src = await flat(10, 20, 30);
  const made: HTMLCanvasElement[] = [];
  const orig = document.createElement.bind(document);
  document.createElement = ((tag: string, o?: ElementCreationOptions) => {
    const el = orig(tag, o);
    if (tag === 'canvas') made.push(el as HTMLCanvasElement);
    return el;
  }) as typeof document.createElement;
  try {
    render(src, NO_EDIT, null, 16, 16); // different size → needs a temporary scaled canvas
  } finally {
    document.createElement = orig as typeof document.createElement;
  }
  expect(made.length).toBeGreaterThan(0);
  for (const c of made) expect(c.width * c.height).toBe(0);
});

test('still renders correctly after the GPU context is lost (back from Slack)', async () => {
  const src = await flat(128, 64, 32);
  const canvas = render(src, NO_EDIT, null, 32, 32);
  const gl = canvas.getContext('webgl2')!;
  const lose = gl.getExtension('WEBGL_lose_context');
  expect(lose).not.toBeNull();
  lose!.loseContext();
  const px = centre(render(src, NO_EDIT, null, 32, 32));
  expect(near(px, [128, 64, 32])).toBe(true);
});
