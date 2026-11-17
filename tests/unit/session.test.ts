import { expect, test } from 'vitest';
import { keys } from 'idb-keyval';
import { clearSession, flushSaves, loadSession, saveSession, type Session } from '../../src/core/session';
import { NO_EDIT } from '../../src/core/types';
import { metrics } from '../helpers/metrics';
import { face, unitVec } from '../helpers/faces';

function session(): Session {
  const desc = unitVec(4);
  const photos = [metrics({ id: 'a', faces: [face(desc)] }), metrics({ id: 'b' })];
  return {
    result: {
      profileId: 'government', photos,
      scored: [{ id: 'a', score: 80, flags: [], shot: 'close', burstId: 0 }, { id: 'b', score: 20, flags: ['blurry'], shot: 'wide', burstId: 1 }],
      person: { descriptor: desc, photoIds: ['a'], faceBox: { photoId: 'a', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } } },
      heroIds: ['a', 'b'],
      thumbs: new Map([['a', new Blob([new Uint8Array(10)], { type: 'image/jpeg' })], ['b', new Blob([new Uint8Array(20)], { type: 'image/jpeg' })]]),
      skipped: ['x.heic'], n: 6, facesFailed: false,
    },
    edits: { all: { ...NO_EDIT, lutName: 'Mono' }, perPhoto: { a: { ...NO_EDIT, brightness: 0.3 } } },
    originals: new Map([['a', new Blob([new Uint8Array(1000)], { type: 'image/jpeg' })]]),
    savedAt: 123,
  };
}

test('save then load round-trips the session', async () => {
  await saveSession(session());
  const s = (await loadSession())!;
  expect(s).not.toBeNull();
  expect(s.result.heroIds).toEqual(['a', 'b']);
  expect(s.result.scored).toEqual(session().result.scored);
  expect(Array.from(s.result.person!.descriptor)).toEqual(Array.from(unitVec(4)));
  expect(s.result.photos[0].faces[0].descriptor).toBeInstanceOf(Float32Array);
  expect(s.result.thumbs.get('b')!.size).toBe(20);
  expect(s.originals.get('a')!.size).toBe(1000);
  expect(s.edits.all.lutName).toBe('Mono');
  expect(s.edits.perPhoto.a.brightness).toBe(0.3);
  expect(s.result.skipped).toEqual(['x.heic']);
});

test('clearSession leaves nothing to load', async () => {
  await saveSession(session());
  await clearSession();
  expect(await loadSession()).toBeNull();
});

const countingBlob = (size: number) => {
  const b = new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
  const read = b.arrayBuffer.bind(b);
  const counter = { reads: 0 };
  b.arrayBuffer = () => { counter.reads++; return read(); };
  return { b, counter };
};

test('quick taps save in order: the latest state wins', async () => {
  await clearSession();
  const s1 = session();
  const s2 = { ...session(), result: { ...session().result, heroIds: ['b', 'a'] } };
  saveSession(s1);
  saveSession(s2);
  await flushSaves();
  expect((await loadSession())!.result.heroIds).toEqual(['b', 'a']);
});

test('an original photo is copied into storage once, not on every tap', async () => {
  await clearSession();
  const { b, counter } = countingBlob(5000);
  const base = session();
  const s = { ...base, originals: new Map([['a', b]]) };
  await saveSession(s);
  await saveSession({ ...s, edits: { ...s.edits, all: { ...s.edits.all, brightness: 0.5 } } });
  await saveSession({ ...s, result: { ...s.result, heroIds: ['b', 'a'] } });
  expect(counter.reads).toBe(1);
});

test('thumbnails are stored once per shoot', async () => {
  await clearSession();
  const { b, counter } = countingBlob(300);
  const base = session();
  const s = { ...base, result: { ...base.result, thumbs: new Map([['a', b]]) } };
  await saveSession(s);
  await saveSession({ ...s, result: { ...s.result, heroIds: ['b', 'a'] } });
  expect(counter.reads).toBe(1);
});

test('originals no longer needed are removed from storage', async () => {
  await clearSession();
  const base = session();
  const blob = (n: number) => new Blob([new Uint8Array(n)], { type: 'image/jpeg' });
  await saveSession({ ...base, originals: new Map([['a', blob(10)], ['b', blob(20)]]) });
  await saveSession({ ...base, originals: new Map([['a', blob(10)], ['c', blob(30)]]) });
  const stored = (await keys()).map(String).filter((k) => k.startsWith('hp:orig:')).sort();
  expect(stored).toEqual(['hp:orig:a', 'hp:orig:c']);
  const back = (await loadSession())!;
  expect([...back.originals.keys()].sort()).toEqual(['a', 'c']);
  expect(back.originals.get('c')!.size).toBe(30);
});

test('clearing removes stored originals and thumbnails too', async () => {
  await saveSession(session());
  await clearSession();
  expect((await keys()).map(String).filter((k) => k.startsWith('hp:'))).toEqual([]);
});
