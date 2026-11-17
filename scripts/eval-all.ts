// Score every shoot that has both samples/metrics/<shoot>.json and samples/labels/<shoot>.json.
// For each posted photo: did a photo from the same moment (or a look-alike) make the app's set, and how high did it rank?
// Usage: npm run eval:all
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { evaluateShoot } from '../src/tune/evaluate';
import { fromJson } from '../src/tune/serialize';
import { groupBursts } from '../src/core/bursts';
import { hamming } from '../src/core/pixels';
import { LOOKALIKE } from '../src/core/heroes';
import type { ProfileId } from '../src/core/types';

let hits = 0, total = 0;
for (const file of readdirSync('samples/labels').filter((f) => f.endsWith('.json'))) {
  const shoot = file.replace(/\.json$/, '');
  const mPath = `samples/metrics/${shoot}.json`;
  if (!existsSync(mPath)) continue;
  const photos = fromJson(JSON.parse(readFileSync(mPath, 'utf8')));
  const labels = JSON.parse(readFileSync(`samples/labels/${file}`, 'utf8')) as { profileId: ProfileId; picked: string[]; n?: number };
  const n = labels.n ?? 6;
  const r = evaluateShoot(photos, labels.profileId, labels.picked, n);
  const bursts = groupBursts(photos);
  const ranked = [...r.scored].sort((a, b) => b.score - a.score);
  const byName = new Map(photos.map((p) => [p.name, p]));
  const heroes = r.heroNames.map((nm) => byName.get(nm)!);
  console.log(`\n${shoot}: ${photos.length} photos, set of ${n}: ${r.heroNames.map((x) => x.replace(/\.JPG$/i, '')).join(' ')}`);
  for (const nm of labels.picked) {
    const p = byName.get(nm);
    if (!p) { console.log(`  ${nm}: not in folder`); continue; }
    total++;
    // Best-ranked photo from the same moment or that looks alike.
    const group = photos.filter((q) => bursts.get(q.id) === bursts.get(p.id) || hamming(q.hash, p.hash) <= LOOKALIKE);
    const bestRank = Math.min(...group.map((q) => ranked.findIndex((s) => s.id === q.id) + 1));
    const inSet = heroes.some((h) => group.includes(h));
    if (inSet) hits++;
    const s = r.scored.find((x) => x.id === p.id)!;
    console.log(`  ${nm}: ${inSet ? 'IN SET' : 'missed'}  rank ${ranked.findIndex((x) => x.id === p.id) + 1} (best of its moment ${bestRank})  ${s.shot}  ${s.flags.join(' ') || '-'}`);
  }
}
console.log(`\nposted photos whose moment made the set: ${hits} of ${total}`);
