export interface Lut {
  name: string;
  size: number;
  /** size³ × 3 floats, red changing fastest (standard .cube order). */
  data: Float32Array;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
}

export class CubeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CubeError';
  }
}

const triple = (parts: string[]): [number, number, number] => [Number(parts[1]), Number(parts[2]), Number(parts[3])];

/** Parse a 3D .cube LUT (Adobe/Resolve format). Throws CubeError with plain-word messages. */
export function parseCube(text: string, name: string): Lut {
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();
    if (key === 'LUT_1D_SIZE') throw new CubeError('This LUT is 1D — only 3D LUTs work.');
    if (key === 'LUT_3D_SIZE') { size = Number(parts[1]); continue; }
    if (key === 'DOMAIN_MIN') { domainMin = triple(parts); continue; }
    if (key === 'DOMAIN_MAX') { domainMax = triple(parts); continue; }
    if (key === 'TITLE' || /^[A-Z_]+$/.test(key)) continue;
    if (parts.length === 3 && parts.every((p) => Number.isFinite(Number(p)))) values.push(Number(parts[0]), Number(parts[1]), Number(parts[2]));
  }
  if (!Number.isInteger(size) || size < 2 || size > 256) throw new CubeError("This file isn't a LUT.");
  if (values.length !== size * size * size * 3) throw new CubeError('This LUT is missing data.');
  return { name, size, data: Float32Array.from(values), domainMin, domainMax };
}
