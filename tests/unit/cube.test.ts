import { expect, test } from 'vitest';
import { CubeError, parseCube } from '../../src/edit/cube';
import { getLut, importLut, listLuts, removeLut } from '../../src/edit/lutStore';

const IDENTITY_2 = `# comment
TITLE "identity"
LUT_3D_SIZE 2
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;

test('parses a size-2 identity cube', () => {
  const l = parseCube(IDENTITY_2, 'id');
  expect(l.size).toBe(2);
  expect(Array.from(l.data.slice(0, 3))).toEqual([0, 0, 0]);
  expect(Array.from(l.data.slice(3, 6))).toEqual([1, 0, 0]);
  expect(Array.from(l.data.slice(21, 24))).toEqual([1, 1, 1]);
  expect(l.domainMin).toEqual([0, 0, 0]);
  expect(l.domainMax).toEqual([1, 1, 1]);
});

test('1D LUTs are refused in plain words', () => {
  expect(() => parseCube('LUT_1D_SIZE 4\n0 0 0\n', 'x')).toThrow('This LUT is 1D — only 3D LUTs work.');
});

test('not a LUT at all', () => {
  expect(() => parseCube('hello world', 'x')).toThrow(CubeError);
  expect(() => parseCube('hello world', 'x')).toThrow("This file isn't a LUT.");
});

test('missing entries', () => {
  expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0\n1 1 1\n', 'x')).toThrow('This LUT is missing data.');
});

test('the four built-in looks parse at size 33', async () => {
  for (const name of ['clean', 'warm', 'punchy', 'mono']) {
    const text = await (await fetch(`${import.meta.env.BASE_URL}luts/${name}.cube`)).text();
    expect(parseCube(text, name).size).toBe(33);
  }
});

test('Mono has equal channels everywhere', async () => {
  const l = parseCube(await (await fetch(`${import.meta.env.BASE_URL}luts/mono.cube`)).text(), 'mono');
  for (let i = 0; i < l.data.length; i += 3) {
    expect(l.data[i]).toBeCloseTo(l.data[i + 1], 5);
    expect(l.data[i]).toBeCloseTo(l.data[i + 2], 5);
  }
});

test('lut store: built-ins first, import, get, remove', async () => {
  const before = await listLuts();
  expect(before.slice(0, 4)).toEqual(['Clean', 'Warm', 'Punchy', 'Mono']);
  const name = await importLut(new File([IDENTITY_2], 'My Look.cube'));
  expect(name).toBe('My Look');
  expect(await listLuts()).toContain('My Look');
  expect((await getLut('My Look')).size).toBe(2);
  expect((await getLut('Mono')).size).toBe(33);
  await removeLut('My Look');
  expect(await listLuts()).not.toContain('My Look');
  await expect(removeLut('Mono')).rejects.toThrow();
});

test('importing a bad file is refused and not stored', async () => {
  await expect(importLut(new File(['nope'], 'Bad.cube'))).rejects.toThrow("This file isn't a LUT.");
  expect(await listLuts()).not.toContain('Bad');
});
