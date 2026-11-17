/**
 * Holds a new app version until HeroPick is idle (home screen or the set, nothing in progress),
 * so an update never reloads the page in the middle of scoring or sharing.
 */
export function createUpdateGate(apply: () => void) {
  let busy = true;
  let ready = false;
  const maybe = () => {
    if (ready && !busy) {
      ready = false;
      apply();
    }
  };
  return {
    updateReady() { ready = true; maybe(); },
    setBusy(b: boolean) { busy = b; maybe(); },
  };
}
