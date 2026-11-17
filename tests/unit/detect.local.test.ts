import { expect, test } from 'vitest';
import { listSamples, sampleFile } from '../helpers/samples';
import { detectFaces, initFaces } from '../../src/faces/detect';
import { loadPhoto } from '../../src/core/load';


test('finds faces with 128-d descriptors in real event photos (local only)', async (ctx) => {
  const urls = await listSamples(10);
  if (urls.length === 0) ctx.skip();
  await initFaces();
  let withFaces = 0;
  const times: number[] = [];
  for (const [i, url] of urls.entries()) {
    const p = await loadPhoto(await sampleFile(url), i);
    const t0 = performance.now();
    const faces = await detectFaces(p.bitmap);
    times.push(performance.now() - t0);
    p.bitmap.close();
    if (faces.length > 0 && faces.every((f) => f.descriptor.length === 128)) withFaces++;
  }
  times.sort((a, b) => a - b);
  console.log(`faces in ${withFaces}/${urls.length}; median detect ${Math.round(times[times.length >> 1])} ms`);
  expect(withFaces).toBeGreaterThanOrEqual(5);
});
