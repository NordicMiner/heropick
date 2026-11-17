import { useEffect, useState } from 'preact/hooks';
import { offlineStatus } from '../offline';

/** 'checking' → 'ready' | 'not-ready'; re-checks every 2 s until ready (the first visit fills the cache). */
export function useOffline(): 'checking' | 'ready' | 'not-ready' {
  const [status, setStatus] = useState<'checking' | 'ready' | 'not-ready'>('checking');
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const s = await offlineStatus().catch(() => 'not-ready' as const);
      if (!live) return;
      setStatus(s);
      if (s !== 'ready') timer = setTimeout(tick, 2000);
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, []);
  return status;
}
