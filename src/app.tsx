import { useEffect, useRef, useState } from 'preact/hooks';
import { photoId } from './core/load';
import { analyzeShoot, rescore } from './core/pipeline';
import { clearSession, flushSaves, loadSession, saveSession, type Session } from './core/session';
import type { Edit, Face, MainPerson, ProfileId } from './core/types';
import { exportJpeg, type ExportMode } from './edit/export';
import { getLut } from './edit/lutStore';
import { COPY } from './ui/copy';
import { canMore, editFor, fewer, keepOriginals, more, nameOf, newSession, originalOf, swap, swapOptions } from './ui/model';
import { EditPanel, HeroSet, Home, PickPerson, PickProfile, Progress, Settings, Viewer, type ShareUi } from './ui/screens';
import { shareFiles, shareOne } from './ui/share';
import { useOffline } from './ui/useOffline';
import { Tune } from './ui/Tune';
import { setUpdateBusy } from './offline';
import './ui/styles.css';

type Screen =
  | { name: 'loading' } | { name: 'home' } | { name: 'profile' } | { name: 'progress'; done: number; total: number }
  | { name: 'set' } | { name: 'viewer'; slot: number } | { name: 'edit'; slot: number | null } | { name: 'person' } | { name: 'settings' };

type TestWindow = Window & { __heropickTestDetect?: (src: ImageBitmap | HTMLCanvasElement) => Promise<Face[]> };

const MODE_KEY = 'hp:exportMode';
function readMode(): ExportMode {
  try { return localStorage.getItem(MODE_KEY) === 'full' ? 'full' : 2048; } catch { return 2048; }
}

export function App() {
  if (location.hash === '#tune') return <main><Tune /></main>;
  return <QuickApp />;
}

function QuickApp() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<ExportMode>(readMode);
  const [error, setError] = useState('');
  const [share, setShare] = useState<{ state: ShareUi['state']; files: File[]; next: number }>({ state: 'idle', files: [], next: 0 });
  const offline = useOffline();
  const mem = useRef(new Map<string, File>()).current; // originals picked this run (lost on reload)

  // An app update may only reload the page when nothing is in progress.
  useEffect(() => {
    const idle = (screen.name === 'home' || screen.name === 'set') && (share.state === 'idle' || share.state === 'done');
    setUpdateBusy(!idle);
  }, [screen.name, share.state]);

  useEffect(() => {
    loadSession()
      .then((s) => { setSession(s); setScreen(s ? { name: 'set' } : { name: 'home' }); })
      .catch(() => setScreen({ name: 'home' }));
  }, []);

  const update = (s: Session) => {
    setSession(s);
    setShare({ state: 'idle', files: [], next: 0 });
    saveSession(s).catch(() => setError(COPY.errors.save));
  };

  async function onFiles(files: File[], profile: ProfileId) {
    setError('');
    mem.clear();
    for (const f of files) mem.set(photoId(f), f);
    setScreen({ name: 'progress', done: 0, total: files.length });
    try {
      const detect = (window as TestWindow).__heropickTestDetect;
      const result = await analyzeShoot(files, profile, (done, total) => setScreen({ name: 'progress', done, total }), detect ? { detect } : {});
      update(newSession(result, mem));
      setScreen({ name: 'set' });
    } catch (e) {
      console.error(e);
      setError(COPY.errors.generic);
      setScreen({ name: 'profile' });
    }
  }

  async function prepareShare(s: Session) {
    setShare({ state: 'preparing', files: [], next: 0 });
    try {
      const files: File[] = [];
      for (const id of s.result.heroIds) {
        const original = originalOf(s, mem, id);
        if (!original) continue;
        const edit = editFor(s, id);
        const lut = edit.lutName ? await getLut(edit.lutName).catch(() => null) : null;
        files.push(await exportJpeg(original, nameOf(s, id), edit, lut, mode));
      }
      // Make sure the latest picks are saved: iOS may close HeroPick while you're in Slack.
      await flushSaves().catch(() => setError(COPY.errors.save));
      // iPhone only opens the share sheet straight from a tap, so preparing and sending are two taps.
      setShare({ state: 'ready', files, next: 0 });
    } catch (e) {
      console.error(e);
      setError(COPY.errors.generic);
      setShare({ state: 'idle', files: [], next: 0 });
    }
  }

  async function send() {
    const r = await shareFiles(share.files);
    if (r === 'shared') setShare({ ...share, state: 'done' });
    else if (r === 'one-by-one') setShare({ ...share, state: 'one-by-one', next: 0 });
    else setShare({ ...share, state: 'ready' });
  }

  async function sendNext() {
    const f = share.files[share.next];
    if (f && (await shareOne(f))) {
      const next = share.next + 1;
      setShare({ ...share, next, state: next >= share.files.length ? 'done' : 'one-by-one' });
    }
  }

  function applyEdit(edit: Edit, scope: 'all' | 'one', slot: number | null) {
    if (!session) return;
    const edits = scope === 'all'
      ? { all: edit, perPhoto: {} }
      : { ...session.edits, perPhoto: { ...session.edits.perPhoto, [session.result.heroIds[slot ?? 0]]: edit } };
    update({ ...session, edits, savedAt: Date.now() });
    setScreen({ name: 'set' });
  }

  function changePerson(person: MainPerson | null) {
    if (!session) return;
    const result = rescore(session.result, person, session.result.heroIds.length);
    update({ ...session, result, originals: keepOriginals(result, mem, session.originals), savedAt: Date.now() });
    setScreen({ name: 'set' });
  }

  let body;
  switch (screen.name) {
    case 'loading': body = null; break;
    case 'home': body = <Home offline={offline} onQuick={() => setScreen({ name: 'profile' })} onSettings={() => setScreen({ name: 'settings' })} />; break;
    case 'profile': body = <PickProfile onFiles={onFiles} onBack={() => setScreen(session ? { name: 'set' } : { name: 'home' })} />; break;
    case 'progress': body = <Progress done={screen.done} total={screen.total} />; break;
    case 'settings':
      body = <Settings mode={mode} offline={offline}
        onMode={(m) => { setMode(m); try { localStorage.setItem(MODE_KEY, String(m)); } catch { /* private mode */ } }}
        onBack={() => setScreen(session ? { name: 'set' } : { name: 'home' })} />;
      break;
    default:
      if (!session) { body = null; break; }
      if (screen.name === 'viewer') {
        body = <Viewer s={session} mem={mem} slot={screen.slot} options={swapOptions(session, mem, screen.slot)}
          onSwap={(id) => { update(swap(session, mem, screen.slot, id)); setScreen({ name: 'set' }); }}
          onEdit={() => setScreen({ name: 'edit', slot: screen.slot })} onBack={() => setScreen({ name: 'set' })} />;
      } else if (screen.name === 'edit') {
        body = <EditPanel s={session} mem={mem} slot={screen.slot} onApply={(e, scope) => applyEdit(e, scope, screen.slot)} onBack={() => setScreen({ name: 'set' })} />;
      } else if (screen.name === 'person') {
        body = <PickPerson s={session} onPick={changePerson} onBack={() => setScreen({ name: 'set' })} />;
      } else {
        body = <HeroSet s={session} mem={mem} canMore={canMore(session, mem)} canChangePerson={mem.size > 0}
          onTile={(slot) => setScreen({ name: 'viewer', slot })}
          onFewer={() => update(fewer(session, mem))} onMore={() => update(more(session, mem))}
          onEdit={() => setScreen({ name: 'edit', slot: null })} onShare={() => prepareShare(session)}
          onChangePerson={() => setScreen({ name: 'person' })}
          onStartNew={() => { clearSession().catch(() => {}); setSession(null); mem.clear(); setScreen({ name: 'profile' }); }}
          share={{ state: share.state, count: share.files.length || session.result.heroIds.length, next: share.next, onSend: send, onNext: sendNext }} />;
      }
  }

  return (
    <main>
      <h1 class={screen.name === 'home' || screen.name === 'loading' ? '' : 'muted'} style={screen.name === 'set' ? { display: 'none' } : undefined}>
        {COPY.appName}
      </h1>
      {error && <p class="warn" role="alert">{error}</p>}
      {body}
    </main>
  );
}
