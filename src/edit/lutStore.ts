import { del, get, keys, set } from 'idb-keyval';
import { parseCube, type Lut } from './cube';

/** Built-in looks: display name → file under public/luts. */
export const BUILT_IN: Record<string, string> = { Clean: 'clean', Warm: 'warm', Punchy: 'punchy', Mono: 'mono' };
const PREFIX = 'hp:lut:';
const cache = new Map<string, Lut>();

export async function listLuts(): Promise<string[]> {
  const imported = (await keys())
    .filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX))
    .map((k) => k.slice(PREFIX.length))
    .sort((a, b) => a.localeCompare(b));
  return [...Object.keys(BUILT_IN), ...imported];
}

export async function getLut(name: string): Promise<Lut> {
  const hit = cache.get(name);
  if (hit) return hit;
  let text: string | undefined;
  if (BUILT_IN[name]) {
    const res = await fetch(`${import.meta.env.BASE_URL}luts/${BUILT_IN[name]}.cube`);
    if (!res.ok) throw new Error(`Look "${name}" is missing`);
    text = await res.text();
  } else {
    text = await get<string>(PREFIX + name);
    if (text === undefined) throw new Error(`Look "${name}" is missing`);
  }
  const lut = parseCube(text, name);
  cache.set(name, lut);
  return lut;
}

/** Store a .cube from the Files app. Returns its display name (file name without extension). */
export async function importLut(file: File): Promise<string> {
  const text = await file.text();
  const name = file.name.replace(/\.cube$/i, '').trim() || 'My look';
  const lut = parseCube(text, name); // throws CubeError before anything is stored
  if (BUILT_IN[name]) throw new Error(`"${name}" is a built-in look — rename the file first.`);
  await set(PREFIX + name, text);
  cache.set(name, lut);
  return name;
}

export async function removeLut(name: string): Promise<void> {
  if (BUILT_IN[name]) throw new Error('Built-in looks can’t be removed.');
  cache.delete(name);
  await del(PREFIX + name);
}
