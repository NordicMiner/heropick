import { render } from 'preact';
import { App } from './app';
import { offlineStatus, startOffline } from './offline';

startOffline();
// Small hooks used by the automated tests and handy for checking a phone from Safari's inspector.
Object.assign(window, {
  __heropickOffline: offlineStatus,
  __heropickInitFaces: () => import('./faces/detect').then((m) => m.initFaces()),
});

render(<App />, document.getElementById('app')!);
