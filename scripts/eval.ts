// Compare HeroPick's hero set with the photos a person actually picked.
// Usage: npm run eval -- samples/metrics/<shoot>.json samples/labels/<shoot>.json
// labels file: { "profileId": "government", "picked": ["5F5A3265.JPG", ...], "n": 6 }
import { readFileSync } from 'node:fs';
import { evaluateShoot } from '../src/tune/evaluate';
import { fromJson } from '../src/tune/serialize';
import type { ProfileId } from '../src/core/types';

const [metricsPath, labelsPath] = process.argv.slice(2);
if (!metricsPath || !labelsPath) {
  console.error('Usage: npm run eval -- <metrics.json> <labels.json>');
  process.exit(1);
}
const photos = fromJson(JSON.parse(readFileSync(metricsPath, 'utf8')));
const labels = JSON.parse(readFileSync(labelsPath, 'utf8')) as { profileId: ProfileId; picked: string[]; n?: number };
const n = labels.n ?? 6;
const r = evaluateShoot(photos, labels.profileId, labels.picked, n);

console.log(`photos ${photos.length}, picked ${labels.picked.length}, set size ${n}`);
console.log(`overlap ${r.overlap} of ${r.heroNames.length}`);
console.log(`heroes: ${r.heroNames.join(', ')}`);
if (r.unknown.length) console.log(`not in folder: ${r.unknown.join(', ')}`);
const ranked = [...r.scored].sort((a, b) => b.score - a.score);
const rankOf = new Map(ranked.map((s, i) => [s.id, i + 1]));
const idByName = new Map(photos.map((p) => [p.name, p.id]));
console.log('missed picks:');
for (const m of r.missed) console.log(`  ${m.name}  score ${m.score}  rank ${rankOf.get(idByName.get(m.name)!)}  ${m.shot}  ${m.flags.join(' ') || '-'}`);
