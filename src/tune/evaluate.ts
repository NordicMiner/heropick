import { groupBursts } from '../core/bursts';
import { pickHeroes } from '../core/heroes';
import { findMainPerson } from '../core/people';
import { PROFILES, type Profile } from '../core/profiles';
import { scoreShoot } from '../core/score';
import type { Flag, PhotoMetrics, ProfileId, Scored, ShotType } from '../core/types';

export interface Evaluation {
  /** Heroes whose burst contains a photo the photographer picked. */
  overlap: number;
  heroNames: string[];
  missed: { name: string; score: number; flags: Flag[]; shot: ShotType }[];
  unknown: string[];
  scored: Scored[];
}

/** How well the app's hero set agrees with the photographer's picks. A sibling frame counts as agreement. */
export function evaluateShoot(photos: PhotoMetrics[], profileId: ProfileId, pickedNames: string[], n: number, profile: Profile = PROFILES[profileId]): Evaluation {
  const bursts = groupBursts(photos);
  const person = findMainPerson(photos);
  const scored = scoreShoot(photos, bursts, person, profile);
  const heroIds = pickHeroes(scored, profile, n, new Map(photos.map((p) => [p.id, p.hash])));
  const byName = new Map(photos.map((p) => [p.name, p]));
  const byId = new Map(photos.map((p) => [p.id, p]));
  const scoredById = new Map(scored.map((s) => [s.id, s]));

  const unknown = pickedNames.filter((nm) => !byName.has(nm));
  const pickedBursts = new Set(pickedNames.filter((nm) => byName.has(nm)).map((nm) => bursts.get(byName.get(nm)!.id)));
  const heroBursts = new Set(heroIds.map((id) => bursts.get(id)));

  const overlap = heroIds.filter((id) => pickedBursts.has(bursts.get(id))).length;
  const missed = pickedNames
    .filter((nm) => byName.has(nm) && !heroBursts.has(bursts.get(byName.get(nm)!.id)))
    .map((nm) => {
      const s = scoredById.get(byName.get(nm)!.id)!;
      return { name: nm, score: Math.round(s.score), flags: s.flags, shot: s.shot };
    });
  return { overlap, heroNames: heroIds.map((id) => byId.get(id)!.name), missed, unknown, scored };
}
