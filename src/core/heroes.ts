import { faceDistance } from './people';
import { hamming } from './pixels';
import type { Profile } from './profiles';
import type { Scored, ShotType } from './types';

const byScore = (a: Scored, b: Scored) => b.score - a.score;

export const clampN = (n: number) => Math.min(10, Math.max(4, Math.round(n)));

/** Photos this close in look (visual hash) count as the same shot, e.g. one podium angle seconds apart. */
export const LOOKALIKE = 12;
/** The same person in the same kind of shot counts as the same shot up to this looser look distance (e.g. a re-framed portrait). */
export const SAME_PERSON_LOOKALIKE = 24;
const SAME_FACE = 0.45;

/**
 * A varied hero set: best of each burst, shot-type mix from the profile, unflagged first,
 * and no two photos that look almost the same (when hashes are given) unless nothing else is left. Ids best-first.
 */
export function pickHeroes(
  scored: Scored[], profile: Profile, n: number,
  hashes?: Map<string, string>,
  /** The face each photo is about (its largest face), to catch the same person in the same pose. */
  subjects?: Map<string, Float32Array>,
): string[] {
  const size = clampN(n);
  const bestOfBurst = new Map<number, Scored>();
  for (const s of scored) {
    const cur = bestOfBurst.get(s.burstId);
    if (!cur || s.score > cur.score) bestOfBurst.set(s.burstId, s);
  }
  const eligible = [...bestOfBurst.values()].sort(byScore);
  const clean = eligible.filter((s) => s.flags.length === 0);
  const flagged = eligible.filter((s) => s.flags.length > 0);
  const k = size <= 6 ? 0 : 1;

  const picked: Scored[] = [];
  const looksLikePicked = (s: Scored) => {
    const h = hashes?.get(s.id);
    if (!h) return false;
    const face = subjects?.get(s.id);
    return picked.some((p) => {
      const ph = hashes!.get(p.id);
      if (!ph) return false;
      const d = hamming(h, ph);
      if (d <= LOOKALIKE) return true;
      const pf = subjects?.get(p.id);
      return !!face && !!pf && p.shot === s.shot && d <= SAME_PERSON_LOOKALIKE && faceDistance(face, pf) <= SAME_FACE;
    });
  };
  const take = (pool: Scored[], count: number, shot?: ShotType, allowLookalike = false) => {
    for (const s of pool) {
      if (picked.length >= size || count <= 0) return;
      if ((shot && s.shot !== shot) || picked.includes(s)) continue;
      if (!allowLookalike && looksLikePicked(s)) continue;
      picked.push(s);
      count--;
    }
  };
  take(clean, profile.mix.wide[k], 'wide');
  take(clean, profile.mix.interaction[k], 'interaction');
  take(clean, size, 'close');
  take(clean, size);
  take(flagged, size);
  take(clean, size, undefined, true);
  take(flagged, size, undefined, true);
  return picked.sort(byScore).map((s) => s.id);
}

/**
 * Replacements for heroIds[slot]: not already a hero, not from another hero's burst.
 * Up to 3 sibling frames of the slot's own burst come first, then the best photo of each other burst, then extra frames.
 */
export function swapCandidates(scored: Scored[], heroIds: string[], slot: number, limit = 12): string[] {
  const byId = new Map(scored.map((s) => [s.id, s]));
  const used = new Set(heroIds.filter((_, i) => i !== slot).map((id) => byId.get(id)?.burstId));
  const slotBurst = byId.get(heroIds[slot])?.burstId;
  const pool = scored.filter((s) => !heroIds.includes(s.id) && !used.has(s.burstId)).sort(byScore);
  const siblings = pool.filter((s) => s.burstId === slotBurst).slice(0, 3);
  // Then one photo per other moment (best first), then any extra frames.
  const seen = new Set<number>([slotBurst ?? -1]);
  const firsts: Scored[] = [];
  for (const s of pool) if (!seen.has(s.burstId)) { seen.add(s.burstId); firsts.push(s); }
  const rest = pool.filter((s) => !siblings.includes(s) && !firsts.includes(s));
  return [...siblings, ...firsts, ...rest].slice(0, limit).map((s) => s.id);
}
