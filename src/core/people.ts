import type { Face, MainPerson, PhotoMetrics, ShotType } from './types';

type PeopleInput = Pick<PhotoMetrics, 'id' | 'faces'>;
interface Opts { minFaceH?: number; maxDist?: number }

export function faceDistance(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

interface Cluster { sum: Float32Array; n: number; members: Float32Array[]; photos: Set<string>; best: { photoId: string; face: Face } }

/** How many recent members a new face is compared against (keeps it fast on big shoots). */
const LINK_WINDOW = 40;

/**
 * Complete-linkage grouping: a face joins a group only if it is close to every (recent) member.
 * A running mean drifts until it matches almost anyone; this doesn't.
 */
function cluster(photos: PeopleInput[], opts: Opts): Cluster[] {
  const minFaceH = opts.minFaceH ?? 0.06;
  const maxDist = opts.maxDist ?? 0.45;
  const clusters: Cluster[] = [];
  for (const p of photos) {
    for (const f of p.faces) {
      if (f.box.h < minFaceH) continue;
      let bestC: Cluster | null = null;
      let bestD = Infinity;
      for (const c of clusters) {
        let worst = 0;
        for (let m = Math.max(0, c.members.length - LINK_WINDOW); m < c.members.length && worst <= maxDist; m++) {
          worst = Math.max(worst, faceDistance(f.descriptor, c.members[m]));
        }
        if (worst < bestD) { bestD = worst; bestC = c; }
      }
      if (bestC && bestD <= maxDist) {
        for (let i = 0; i < f.descriptor.length; i++) bestC.sum[i] += f.descriptor[i];
        bestC.n++;
        bestC.members.push(f.descriptor);
        bestC.photos.add(p.id);
        if (f.box.h > bestC.best.face.box.h) bestC.best = { photoId: p.id, face: f };
      } else {
        clusters.push({ sum: Float32Array.from(f.descriptor), n: 1, members: [f.descriptor], photos: new Set([p.id]), best: { photoId: p.id, face: f } });
      }
    }
  }
  return clusters.sort((a, b) => b.photos.size - a.photos.size || b.n - a.n);
}

const toPerson = (c: Cluster): MainPerson => ({
  descriptor: c.sum.map((v) => v / c.n) as Float32Array,
  photoIds: [...c.photos],
  faceBox: { photoId: c.best.photoId, box: c.best.face.box },
});

/** The person who appears prominently in the most photos (at least 3), or null. */
export function findMainPerson(photos: PeopleInput[], opts: Opts = {}): MainPerson | null {
  const top = cluster(photos, opts)[0];
  return top && top.photos.size >= 3 ? toPerson(top) : null;
}

/** Candidates for "tap a different face", most-photographed first. */
export function topPeople(photos: PeopleInput[], k = 5, opts: Opts = {}): MainPerson[] {
  return cluster(photos, opts).slice(0, k).map(toPerson);
}

export function isPerson(face: Face, person: MainPerson, maxDist = 0.45): boolean {
  return faceDistance(face.descriptor, person.descriptor) <= maxDist;
}

export function classifyShot(faces: Face[], person: MainPerson | null): ShotType {
  if (faces.length === 0) return 'other'; // trees, food, signs: not a room shot
  const prominent = faces.filter((f) => f.box.h >= 0.06);
  if (prominent.length >= 2 && (!person || prominent.some((f) => isPerson(f, person)))) return 'interaction';
  const largest = faces.reduce((a, b) => (b.box.h > a.box.h ? b : a));
  const subject = person ? faces.filter((f) => isPerson(f, person)).sort((a, b) => b.box.h - a.box.h)[0] ?? largest : largest;
  if (subject.box.h >= 0.1) return 'close';
  if (largest.box.h < 0.08) return 'wide'; // people small in a big scene: a stage or the room
  return 'other';
}

/** Each photo's main face (largest), used to spot the same person in the same pose. */
export function subjectDescriptors(photos: PhotoMetrics[]): Map<string, Float32Array> {
  const out = new Map<string, Float32Array>();
  for (const p of photos) {
    if (p.faces.length) out.set(p.id, p.faces.reduce((a, b) => (b.box.h > a.box.h ? b : a)).descriptor);
  }
  return out;
}
