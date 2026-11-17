import { registerSW } from 'virtual:pwa-register';
import { flushSaves } from './core/session';
import { createUpdateGate } from './updateGate';

const MODELS = ['ssd_mobilenetv1', 'face_landmark_68', 'face_recognition', 'face_expression'].flatMap((m) => [
  `models/${m}_model-weights_manifest.json`,
  `models/${m}_model.bin`,
]);
const LUTS = ['clean', 'warm', 'punchy', 'mono'].map((l) => `luts/${l}.cube`);

let gate = createUpdateGate(() => {});

/** Start the service worker that keeps the app on the phone. New versions wait until the app is idle. */
export function startOffline(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { gate.updateReady(); },
  });
  gate = createUpdateGate(() => {
    flushSaves().catch(() => {}).then(() => updateSW(true));
  });
}

/** The app says when it's safe to update (home screen or the set, nothing being prepared). */
export function setUpdateBusy(busy: boolean): void {
  gate.setBusy(busy);
}

/** 'ready' only when the app, the face models and the looks are all saved on this device. */
export async function offlineStatus(): Promise<'ready' | 'not-ready'> {
  if (!('caches' in window) || !navigator.serviceWorker?.controller) return 'not-ready';
  const base = import.meta.env.BASE_URL;
  const urls = ['index.html', ...MODELS, ...LUTS].map((u) => new URL(base + u, location.origin).href);
  for (const u of urls) {
    if (!(await caches.match(u, { ignoreSearch: true }))) return 'not-ready';
  }
  return 'ready';
}
