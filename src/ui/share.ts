export type ShareResult = 'shared' | 'one-by-one' | 'cancelled';

/** Share all files through the iOS share sheet; if the device can't take several at once, say so. */
export async function shareFiles(files: File[]): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files }) && nav.share) {
    try {
      await nav.share({ files });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      if (files.length === 1) throw e;
      return 'one-by-one';
    }
  }
  return 'one-by-one';
}

/** One file per tap (each share needs its own tap on iPhone). */
export async function shareOne(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false;
    // No share sheet (desktop): fall back to a download.
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    return true;
  }
}
