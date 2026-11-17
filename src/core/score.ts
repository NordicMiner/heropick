import { classifyShot, isPerson } from './people';
import type { Profile } from './profiles';
import type { Face, Flag, MainPerson, PhotoMetrics, Scored } from './types';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Below this face height (share of the photo) eye readings are unreliable, e.g. someone looking down at notes. */
const READABLE_FACE = 0.1;

/** Percentile rank 0–1 of log(1+v) within the shoot; ties share the average rank. */
export function percentiles(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 1);
  const idx = values.map((v, i) => [Math.log1p(Math.max(0, v)), i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const rank = (i + j) / 2 / (n - 1);
    for (let k = i; k <= j; k++) out[idx[k][1]] = rank;
    i = j + 1;
  }
  return out;
}

/** The face the photo is "about": the main person's face if present, otherwise the largest. */
export function subjectFace(faces: Face[], person: MainPerson | null): { face: Face | null; isMain: boolean } {
  if (faces.length === 0) return { face: null, isMain: false };
  if (person) {
    const mine = faces.filter((f) => isPerson(f, person)).sort((a, b) => b.box.h - a.box.h)[0];
    if (mine) return { face: mine, isMain: true };
  }
  return { face: faces.reduce((a, b) => (b.box.h > a.box.h ? b : a)), isMain: false };
}

export function scoreShoot(photos: PhotoMetrics[], bursts: Map<string, number>, person: MainPerson | null, profile: Profile): Scored[] {
  const subj = percentiles(photos.map((p) => p.sharpSubject));
  const glob = percentiles(photos.map((p) => p.sharpGlobal));
  const w = profile.w;
  // "Dark" is relative to the shoot: a stage event is dark overall, a daytime one is not.
  const means = photos.map((p) => p.exposure.mean).sort((a, b) => a - b);
  const median = means.length ? means[means.length >> 1] : 0.4;
  const darkRef = Math.min(0.2, median);
  const darkFlag = Math.min(0.12, 0.6 * median);
  return photos.map((p, i) => {
    const { face, isMain } = subjectFace(p.faces, person);
    const e = p.exposure;
    const c = {
      sharpSubject: subj[i],
      sharpGlobal: glob[i],
      eyes: face && face.box.h >= READABLE_FACE ? face.eyesOpen : 0.5,
      expression: face ? face.happy * 0.6 + (1 - face.mouthOpen) * 0.4 : 0.5,
      prominence: face ? Math.min(1, face.box.h / 0.25) : 0,
      person: person ? (isMain ? 1 : 0) : 0.5,
      exposure: clamp01(1 - 4 * e.clipHigh - (profile.penalizeDark ? Math.max(0, darkRef - e.mean) * 5 + Math.max(0, e.clipLow - 0.3) * 2 : 0)),
    };
    const flags: Flag[] = [];
    if (subj[i] < 0.15) flags.push('blurry');
    if (face && face.box.h >= READABLE_FACE && face.eyesOpen < 0.3) flags.push('eyesClosed');
    if (profile.penalizeDark && e.mean < darkFlag) flags.push('dark');
    if (e.clipHigh > 0.08) flags.push('blown');
    if (p.faces.length === 0 && profile.requireFace) flags.push('noSubject');
    const raw =
      100 *
      (w.sharpSubject * c.sharpSubject + w.sharpGlobal * c.sharpGlobal + w.eyes * c.eyes + w.expression * c.expression +
        w.prominence * c.prominence + w.person * c.person + w.exposure * c.exposure);
    return {
      id: p.id,
      score: Math.min(100, Math.max(0, raw - 25 * flags.length)),
      flags,
      shot: classifyShot(p.faces, person),
      burstId: bursts.get(p.id) ?? -1,
    };
  });
}
