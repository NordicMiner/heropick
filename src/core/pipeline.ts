import { groupBursts } from './bursts';
import { clampN, pickHeroes } from './heroes';
import { loadPhoto, photoId, UnreadablePhotoError } from './load';
import { findMainPerson } from './people';
import { dHash, exposureStats, sharpness, toGray } from './pixels';
import { PROFILES } from './profiles';
import { scoreShoot } from './score';
import type { Face, MainPerson, PhotoMetrics, ProfileId, Rect, Scored } from './types';

export interface ShootResult {
  profileId: ProfileId;
  photos: PhotoMetrics[];
  scored: Scored[];
  person: MainPerson | null;
  heroIds: string[];
  thumbs: Map<string, Blob>;
  skipped: string[];
  n: number;
  /** True when the face finder failed for some photos; those were scored on sharpness and light only. */
  facesFailed: boolean;
}

type Detect = (src: ImageBitmap | HTMLCanvasElement) => Promise<Face[]>;

const yieldToUi = () => new Promise<void>((r) => setTimeout(r));

function subjectRect(faces: Face[]): Rect {
  if (faces.length === 0) return { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  const f = faces.reduce((a, b) => (b.box.h > a.box.h ? b : a)).box;
  const dx = f.w * 0.15, dy = f.h * 0.15; // expand by 30% overall
  return { x: f.x - dx, y: f.y - dy, w: f.w + 2 * dx, h: f.h + 2 * dy };
}

/** Decode and measure photos one at a time, then score and pick a hero set. */
export async function analyzeShoot(
  files: File[],
  profileId: ProfileId,
  onProgress: (done: number, total: number) => void,
  deps: { detect?: Detect } = {},
): Promise<ShootResult> {
  let detect: Detect;
  try {
    detect = deps.detect ?? (await import('../faces/detect')).detectFaces;
  } catch {
    detect = async () => { throw new Error('face finder unavailable'); };
  }
  let facesFailed = false;
  let failuresInARow = 0;
  const photos: PhotoMetrics[] = [];
  const thumbs = new Map<string, Blob>();
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = photoId(file);
    if (!seen.has(id)) {
      seen.add(id);
      try {
        const p = await loadPhoto(file, i);
        try {
          const { width: w, height: h } = p.analysis;
          const gray = toGray(p.analysis);
          let faces: Face[] = [];
          if (failuresInARow < 3) {
            try {
              faces = await detect(p.bitmap);
              failuresInARow = 0;
            } catch (e) {
              console.warn('face finder failed', e);
              facesFailed = true;
              failuresInARow++;
            }
          } else {
            facesFailed = true;
          }
          photos.push({
            id: p.id, name: p.name, takenAt: p.takenAt, order: p.order, hash: dHash(gray, w, h),
            width: p.width, height: p.height,
            sharpGlobal: sharpness(gray, w, h),
            sharpSubject: sharpness(gray, w, h, subjectRect(faces)),
            exposure: exposureStats(p.analysis),
            faces,
          });
          thumbs.set(p.id, p.thumb);
        } finally {
          p.bitmap.close();
        }
      } catch (e) {
        if (e instanceof UnreadablePhotoError) skipped.push(file.name);
        else throw e;
      }
    }
    onProgress(i + 1, files.length);
    await yieldToUi();
  }

  const base: ShootResult = { profileId, photos, scored: [], person: null, heroIds: [], thumbs, skipped, n: 6, facesFailed };
  return rescore(base, findMainPerson(photos), 6);
}

/** Re-score for a different main person or set size. Pure: no decoding. */
export function rescore(result: ShootResult, person: MainPerson | null, n: number): ShootResult {
  const profile = PROFILES[result.profileId];
  const bursts = groupBursts(result.photos);
  const scored = scoreShoot(result.photos, bursts, person, profile);
  const hashes = new Map(result.photos.map((p) => [p.id, p.hash]));
  return { ...result, person, n: clampN(n), scored, heroIds: pickHeroes(scored, profile, n, hashes) };
}
