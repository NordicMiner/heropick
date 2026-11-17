import { useState } from 'preact/hooks';
import { analyzeShoot, type ShootResult } from '../core/pipeline';
import { PROFILES } from '../core/profiles';
import type { Face, ProfileId } from '../core/types';
import { toJson } from '../tune/serialize';
import { BlobImg } from './Pictures';

type TestWindow = Window & { __heropickTestDetect?: (src: ImageBitmap | HTMLCanvasElement) => Promise<Face[]> };

function download(name: string, data: unknown) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Desktop page (#tune): mark the photos you would have sent, then download picks + measurements for tuning. */
export function Tune() {
  const [profile, setProfile] = useState<ProfileId>('government');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ShootResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function onFiles(files: File[]) {
    setResult(null);
    setPicked(new Set());
    const detect = (window as TestWindow).__heropickTestDetect;
    const r = await analyzeShoot(files, profile, (d, t) => setProgress(`Checking photos… ${d} of ${t}`), detect ? { detect } : {});
    setProgress('');
    setResult(r);
  }

  const toggle = (name: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(name)) n.delete(name); else n.add(name);
    return n;
  });

  const photos = result ? [...result.photos].sort((a, b) => a.takenAt - b.takenAt || a.name.localeCompare(b.name)) : [];
  const burstOf = new Map(result?.scored.map((s) => [s.id, s.burstId]) ?? []);
  const heroes = new Set(result?.heroIds ?? []);

  return (
    <div class="stack">
      <h1>Tune</h1>
      <p>Choose every photo from one shoot. Then tap the ones you would have sent.</p>
      <div class="row">
        {Object.values(PROFILES).map((p) => (
          <button key={p.id} class={p.id === profile ? 'selected' : ''} onClick={() => setProfile(p.id)}>{p.label}</button>
        ))}
      </div>
      <label class="button primary">
        Choose photos
        <input class="file-input" type="file" multiple accept="image/*"
          onChange={(e) => { const f = Array.from((e.currentTarget as HTMLInputElement).files ?? []); if (f.length) onFiles(f); }} />
      </label>
      {progress && <p role="status">{progress}</p>}
      {result && (
        <>
          <div class="row">
            <strong class="grow">{picked.size} picked</strong>
            <button onClick={() => download('picks.json', { profileId: profile, picked: [...picked], n: 6 })}>Download picks</button>
            <button onClick={() => download('measurements.json', toJson(result.photos))}>Download measurements</button>
          </div>
          <p class="muted">★ = the app's current pick. A gap means a new moment.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px' }}>
            {photos.map((p, i) => {
              const newBurst = i > 0 && burstOf.get(p.id) !== burstOf.get(photos[i - 1].id);
              const on = picked.has(p.name);
              const thumb = result.thumbs.get(p.id);
              return (
                <button key={p.id} data-testid="tune-photo" class={`tile ${on ? 'selected' : ''}`} onClick={() => toggle(p.name)}
                  style={{ marginLeft: newBurst ? '10px' : 0, position: 'relative' }} aria-pressed={on} aria-label={p.name}>
                  {thumb ? <BlobImg blob={thumb} /> : null}
                  <span style={{ position: 'absolute', left: 4, bottom: 2, fontSize: 12, background: '#000a', padding: '0 4px' }}>
                    {heroes.has(p.id) ? '★ ' : ''}{p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
