export type ProfileId = 'government' | 'wedding' | 'soccer' | 'band';
export interface Rect { x: number; y: number; w: number; h: number } // normalized 0–1 of image size
export interface Face {
  box: Rect;
  eyesOpen: number; // 0 closed … 1 open (min of both eyes)
  happy: number; // 0–1 from expression net
  mouthOpen: number; // 0–1
  descriptor: Float32Array; // length 128
}
export interface ExposureStats { mean: number; clipHigh: number; clipLow: number }
export interface PhotoMetrics {
  id: string; name: string; takenAt: number;
  order: number;
  hash: string;
  width: number; height: number;
  sharpGlobal: number; sharpSubject: number;
  exposure: ExposureStats;
  faces: Face[];
}
export type ShotType = 'close' | 'interaction' | 'wide' | 'other';
export type Flag = 'blurry' | 'eyesClosed' | 'dark' | 'blown' | 'noSubject';
export interface Scored { id: string; score: number; flags: Flag[]; shot: ShotType; burstId: number }
export interface MainPerson { descriptor: Float32Array; photoIds: string[]; faceBox: { photoId: string; box: Rect } }
export interface Edit { brightness: number; contrast: number; lutName: string | null; lutStrength: number }
export const NO_EDIT: Edit = { brightness: 0, contrast: 0, lutName: null, lutStrength: 1 };
