import { expect, test } from 'vitest';
import { analyzeShoot } from '../../src/core/pipeline';
import { toJson } from '../../src/tune/serialize';
import { listSamples, sampleFile, writeSample } from '../helpers/samples';

declare const __HEROPICK_DUMP__: string;

/**
 * Local only: measure every photo in HEROPICK_SAMPLES once and save to samples/metrics/<HEROPICK_DUMP>.json,
 * so tuning runs (`npm run eval`) take seconds. Photos and results never leave this PC.
 */
test('measure a real shoot for tuning (local only)', { timeout: 60 * 60_000 }, async (ctx) => {
  if (!__HEROPICK_DUMP__) ctx.skip();
  const paths = await listSamples(100_000);
  if (paths.length === 0) ctx.skip();
  const files: File[] = [];
  for (const path of paths) {
    files.push(await sampleFile(path));
    if (files.length % 25 === 0 || files.length === paths.length) console.log(`read ${files.length}/${paths.length}`);
  }
  const t0 = performance.now();
  let last = 0;
  const r = await analyzeShoot(files, 'government', (done, total) => {
    if (done - last >= 25 || done === total) { last = done; console.log(`measured ${done}/${total}`); }
  });
  console.log(`done in ${Math.round((performance.now() - t0) / 1000)} s; skipped ${r.skipped.length}`);
  if (r.skipped.length === paths.length) throw new Error('every photo was skipped — check the sample folder');
  await writeSample(`${__HEROPICK_DUMP__}.json`, JSON.stringify(toJson(r.photos)));
  expect(r.photos.length).toBeGreaterThan(0);
});
