import { useEffect, useState } from 'preact/hooks';
import { topPeople } from '../core/people';
import { PROFILES } from '../core/profiles';
import type { Session } from '../core/session';
import { NO_EDIT, type Edit, type MainPerson, type ProfileId } from '../core/types';
import { importLut, listLuts, removeLut, BUILT_IN } from '../edit/lutStore';
import type { ExportMode } from '../edit/export';
import { COPY } from './copy';
import { BlobImg, EditedImage, FaceCrop } from './Pictures';
import { editFor, MIN_N, originalOf } from './model';

export function OfflineLine({ status }: { status: 'ready' | 'not-ready' | 'checking' }) {
  return (
    <p class="status" role="status">
      <span class={`dot ${status === 'ready' ? 'ok' : ''}`} />
      {status === 'ready' ? COPY.settings.offlineReady : COPY.settings.notReady}
    </p>
  );
}

export function Home(p: { offline: 'ready' | 'not-ready' | 'checking'; onQuick: () => void; onSettings: () => void }) {
  return (
    <div class="stack">
      <OfflineLine status={p.offline} />
      <button class="primary big" onClick={p.onQuick}>{COPY.home.quick}</button>
      <button class="big" disabled>{COPY.home.lightroom}</button>
      <button onClick={p.onSettings}>{COPY.home.settings}</button>
    </div>
  );
}

export function PickProfile(p: { onFiles: (files: File[], profile: ProfileId) => void; onBack: () => void }) {
  const [profile, setProfile] = useState<ProfileId>('government');
  return (
    <div class="stack">
      <h2>{COPY.profile.title}</h2>
      <div class="grid">
        {Object.values(PROFILES).map((pr) => (
          <button key={pr.id} class={pr.id === profile ? 'selected' : ''} aria-pressed={pr.id === profile} onClick={() => setProfile(pr.id)}>
            {pr.label}
          </button>
        ))}
      </div>
      <label class="button primary big">
        {COPY.profile.choose}
        <input
          class="file-input" type="file" multiple accept="image/*"
          onChange={(e) => {
            const files = Array.from((e.currentTarget as HTMLInputElement).files ?? []);
            if (files.length) p.onFiles(files, profile);
          }}
        />
      </label>
      <button onClick={p.onBack}>{COPY.set.back}</button>
    </div>
  );
}

export function Progress(p: { done: number; total: number }) {
  return (
    <div class="stack" role="status">
      <h2>{COPY.progress(p.done, p.total)}</h2>
      <div class="progress"><div style={{ width: `${p.total ? (100 * p.done) / p.total : 0}%` }} /></div>
    </div>
  );
}

export function PersonChip(p: { s: Session; canChange: boolean; onChange: () => void }) {
  const person = p.s.result.person;
  const thumb = person ? p.s.result.thumbs.get(person.faceBox.photoId) : undefined;
  return (
    <div class="chip">
      {person && thumb ? <FaceCrop thumb={thumb} box={person.faceBox.box} /> : null}
      <div class="grow">{person ? COPY.person.main : COPY.person.none}</div>
      {p.canChange ? <button onClick={p.onChange}>{COPY.person.change}</button> : <span class="muted">{COPY.person.pickAgain}</span>}
    </div>
  );
}

export function PickPerson(p: { s: Session; onPick: (person: MainPerson | null) => void; onBack: () => void }) {
  const people = topPeople(p.s.result.photos, 5);
  return (
    <div class="stack">
      <h2>{COPY.person.title}</h2>
      {people.map((person, i) => {
        const thumb = p.s.result.thumbs.get(person.faceBox.photoId);
        return (
          <button key={i} onClick={() => p.onPick(person)} aria-label={`Person ${i + 1}`}>
            {thumb ? <FaceCrop thumb={thumb} box={person.faceBox.box} /> : null}
            <span>{person.photoIds.length}</span>
          </button>
        );
      })}
      <button onClick={() => p.onPick(null)}>{COPY.person.none}</button>
      <button onClick={p.onBack}>{COPY.set.back}</button>
    </div>
  );
}

export function HeroSet(p: {
  s: Session; mem: Map<string, File>; canMore: boolean; canChangePerson: boolean;
  onTile: (slot: number) => void; onFewer: () => void; onMore: () => void; onEdit: () => void; onShare: () => void;
  onChangePerson: () => void; onStartNew: () => void; share: ShareUi;
}) {
  const { s } = p;
  const ids = s.result.heroIds;
  return (
    <div class="stack">
      <h1>{COPY.set.title(ids.length)}</h1>
      {s.result.skipped.length > 0 && <p class="warn">{COPY.skipped(s.result.skipped.length)}</p>}
      {s.result.facesFailed && <p class="warn">{COPY.noFaces}</p>}
      <PersonChip s={s} canChange={p.canChangePerson} onChange={p.onChangePerson} />
      <div class="row">
        <button class="grow" onClick={p.onFewer} disabled={ids.length <= MIN_N}>{COPY.set.fewer}</button>
        <button class="grow" onClick={p.onMore} disabled={!p.canMore}>{COPY.set.more}</button>
      </div>
      <div class="grid">
        {ids.map((id, slot) => {
          const edit = editFor(s, id);
          const thumb = s.result.thumbs.get(id);
          return (
            <button key={id} class="tile" data-testid="hero-tile" data-id={id} data-look={edit.lutName ?? ''} onClick={() => p.onTile(slot)}
              aria-label={`Photo ${slot + 1}`}>
              {thumb ? <EditedImage blob={thumb} edit={edit} maxEdge={640} /> : null}
            </button>
          );
        })}
      </div>
      <button onClick={p.onStartNew}>{COPY.set.startNew}</button>
      <div class="bar">
        <div class="row">
          <button class="grow" onClick={p.onEdit}>{COPY.set.edit}</button>
          <ShareButton ui={p.share} onShare={p.onShare} />
        </div>
      </div>
    </div>
  );
}

export interface ShareUi {
  state: 'idle' | 'preparing' | 'ready' | 'one-by-one' | 'done';
  count: number;
  next: number;
  onSend: () => void;
  onNext: () => void;
}

function ShareButton({ ui, onShare }: { ui: ShareUi; onShare: () => void }) {
  if (ui.state === 'preparing') return <button class="grow primary" disabled>{COPY.set.preparing}</button>;
  if (ui.state === 'ready') return <button class="grow primary" onClick={ui.onSend}>{COPY.set.send(ui.count)}</button>;
  if (ui.state === 'one-by-one') return <button class="grow primary" onClick={ui.onNext}>{COPY.set.shareNext(ui.next + 1, ui.count)}</button>;
  return <button class="grow primary" onClick={onShare}>{ui.state === 'done' ? `${COPY.set.sent} · ${COPY.set.share}` : COPY.set.share}</button>;
}

export function Viewer(p: { s: Session; mem: Map<string, File>; slot: number; options: string[];
  onSwap: (id: string) => void; onEdit: () => void; onBack: () => void }) {
  const [showSwap, setShowSwap] = useState(false);
  const id = p.s.result.heroIds[p.slot];
  const blob = originalOf(p.s, p.mem, id) ?? p.s.result.thumbs.get(id);
  return (
    <div class="stack viewer">
      {blob ? <EditedImage blob={blob} edit={editFor(p.s, id)} maxEdge={Math.round(window.innerWidth * (window.devicePixelRatio || 1))} /> : null}
      <div class="row">
        <button class="grow" onClick={() => setShowSwap((v) => !v)}>{COPY.set.swap}</button>
        <button class="grow" onClick={p.onEdit}>{COPY.set.edit}</button>
        <button class="grow" onClick={p.onBack}>{COPY.set.back}</button>
      </div>
      {showSwap && (
        <div class="strip">
          {p.options.map((o) => {
            const t = p.s.result.thumbs.get(o);
            return (
              <button key={o} data-testid="swap-option" data-id={o} onClick={() => p.onSwap(o)} aria-label="Use this photo">
                {t ? <BlobImg blob={t} /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EditPanel(p: { s: Session; mem: Map<string, File>; slot: number | null;
  onApply: (edit: Edit, scope: 'all' | 'one') => void; onBack: () => void }) {
  const id = p.s.result.heroIds[p.slot ?? 0];
  const [edit, setEdit] = useState<Edit>(() => ({ ...(id ? editFor(p.s, id) : NO_EDIT) }));
  const [luts, setLuts] = useState<string[]>(Object.keys(BUILT_IN));
  useEffect(() => { listLuts().then(setLuts).catch(() => {}); }, []);
  // Preview from the original (sharp), falling back to the thumbnail.
  const blob = id ? originalOf(p.s, p.mem, id) ?? p.s.result.thumbs.get(id) : undefined;
  const screenEdge = Math.round(Math.min(1600, window.innerWidth * (window.devicePixelRatio || 1)));
  const set = (k: keyof Edit, v: number | string | null) => setEdit((e) => ({ ...e, [k]: v }));
  return (
    <div class="stack viewer">
      {blob ? <EditedImage blob={blob} edit={edit} maxEdge={screenEdge} /> : null}
      <label class="slider">{COPY.edit.brightness}
        <input type="range" min={-1} max={1} step={0.05} value={edit.brightness} onInput={(e) => set('brightness', Number((e.currentTarget as HTMLInputElement).value))} />
      </label>
      <label class="slider">{COPY.edit.contrast}
        <input type="range" min={-1} max={1} step={0.05} value={edit.contrast} onInput={(e) => set('contrast', Number((e.currentTarget as HTMLInputElement).value))} />
      </label>
      <h2>{COPY.edit.look}</h2>
      <div class="row">
        <button class={edit.lutName === null ? 'selected' : ''} onClick={() => set('lutName', null)}>{COPY.edit.none}</button>
        {luts.map((l) => (
          <button key={l} class={edit.lutName === l ? 'selected' : ''} aria-pressed={edit.lutName === l} onClick={() => set('lutName', l)}>{l}</button>
        ))}
      </div>
      {edit.lutName && (
        <label class="slider">{COPY.edit.strength}
          <input type="range" min={0} max={1} step={0.05} value={edit.lutStrength} onInput={(e) => set('lutStrength', Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
      )}
      <div class="row">
        <button class="grow primary" onClick={() => p.onApply(edit, 'all')}>{COPY.edit.applyAll}</button>
        {p.slot !== null && <button class="grow" onClick={() => p.onApply(edit, 'one')}>{COPY.edit.justThis}</button>}
      </div>
      <button onClick={p.onBack}>{COPY.set.back}</button>
    </div>
  );
}

export function Settings(p: { mode: ExportMode; onMode: (m: ExportMode) => void; onBack: () => void; offline: 'ready' | 'not-ready' | 'checking' }) {
  const [luts, setLuts] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const refresh = () => listLuts().then(setLuts).catch(() => {});
  useEffect(() => { refresh(); }, []);
  return (
    <div class="stack">
      <h1>{COPY.settings.title}</h1>
      <OfflineLine status={p.offline} />
      <h2>{COPY.settings.looks}</h2>
      {luts.map((l) => (
        <div class="row" key={l}>
          <span class="grow">{l}</span>
          {!BUILT_IN[l] && <button onClick={() => removeLut(l).then(refresh)}>{COPY.settings.remove}</button>}
        </div>
      ))}
      <label class="button">
        {COPY.settings.addLook}
        <input class="file-input" type="file" accept=".cube"
          onChange={async (e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            if (!f) return;
            try { setMsg(`Added "${await importLut(f)}"`); } catch (err) { setMsg((err as Error).message); }
            refresh();
          }} />
      </label>
      {msg && <p>{msg}</p>}
      <h2>{COPY.settings.exportSize}</h2>
      <div class="row">
        <button class={p.mode === 2048 ? 'selected' : ''} aria-pressed={p.mode === 2048} onClick={() => p.onMode(2048)}>{COPY.settings.chat}</button>
        <button class={p.mode === 'full' ? 'selected' : ''} aria-pressed={p.mode === 'full'} onClick={() => p.onMode('full')}>{COPY.settings.full}</button>
      </div>
      <button onClick={p.onBack}>{COPY.set.back}</button>
    </div>
  );
}
