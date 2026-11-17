import type { ProfileId } from './types';

export interface Profile {
  id: ProfileId;
  label: string;
  w: { sharpSubject: number; sharpGlobal: number; eyes: number; expression: number; prominence: number; person: number; exposure: number };
  penalizeDark: boolean;
  requireFace: boolean;
  /** [count when n ≤ 6, count when n > 6] */
  mix: { wide: [number, number]; interaction: [number, number] };
}

// Starting values — tuned against real shoots in Task 14.
export const PROFILES: Record<ProfileId, Profile> = {
  government: {
    id: 'government', label: 'Government',
    w: { sharpSubject: 0.3, sharpGlobal: 0.05, eyes: 0.2, expression: 0.15, prominence: 0.1, person: 0.15, exposure: 0.05 },
    penalizeDark: true, requireFace: false, mix: { wide: [2, 3], interaction: [1, 2] },
  },
  wedding: {
    id: 'wedding', label: 'Wedding',
    w: { sharpSubject: 0.25, sharpGlobal: 0.05, eyes: 0.2, expression: 0.25, prominence: 0.1, person: 0.1, exposure: 0.05 },
    penalizeDark: true, requireFace: false, mix: { wide: [1, 1], interaction: [1, 2] },
  },
  soccer: {
    id: 'soccer', label: 'Soccer',
    w: { sharpSubject: 0.45, sharpGlobal: 0.15, eyes: 0.05, expression: 0.05, prominence: 0.2, person: 0.05, exposure: 0.05 },
    penalizeDark: true, requireFace: false, mix: { wide: [0, 1], interaction: [1, 1] },
  },
  band: {
    id: 'band', label: 'Band',
    w: { sharpSubject: 0.4, sharpGlobal: 0.1, eyes: 0.05, expression: 0.1, prominence: 0.2, person: 0.15, exposure: 0 },
    penalizeDark: false, requireFace: false, mix: { wide: [1, 1], interaction: [0, 1] },
  },
};
