export interface Pt { x: number; y: number }

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** (|p2−p6| + |p3−p5|) / (2·|p1−p4|), points in dlib order p1..p6. */
export function eyeAspectRatio(eye: Pt[]): number {
  const w = dist(eye[0], eye[3]);
  if (w === 0) return 0;
  return (dist(eye[1], eye[5]) + dist(eye[2], eye[4])) / (2 * w);
}

/** 0 closed … 1 open, from the more-closed eye. */
export function eyesOpenScore(left: Pt[], right: Pt[]): number {
  const ear = Math.min(eyeAspectRatio(left), eyeAspectRatio(right));
  return clamp01((ear - 0.15) / (0.27 - 0.15));
}

/** Inner-lip gap (dlib 0-indexed 61/67, 62/66, 63/65) relative to face height; 0.08 → 1. */
export function mouthOpenScore(lm: Pt[], faceHeightPx: number): number {
  if (faceHeightPx <= 0) return 0;
  const gap = (dist(lm[61], lm[67]) + dist(lm[62], lm[66]) + dist(lm[63], lm[65])) / 3;
  return clamp01(gap / faceHeightPx / 0.08);
}
