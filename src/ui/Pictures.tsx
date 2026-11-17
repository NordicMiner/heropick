import { useEffect, useRef, useState } from 'preact/hooks';
import type { Edit, Rect } from '../core/types';
import { getLut } from '../edit/lutStore';
import { render } from '../edit/render';

/** A blob shown through the same render() used for export, so the preview matches what gets sent. */
export function EditedImage({ blob, edit, maxEdge }: { blob: Blob; edit: Edit; maxEdge: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      try {
        const lut = edit.lutName ? await getLut(edit.lutName).catch(() => null) : null;
        if (!live || !ref.current) return;
        const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
        const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
        const out = render(bmp, edit, lut, w, h);
        const c = ref.current;
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(out, 0, 0);
      } finally {
        bmp.close();
      }
    })().catch(() => {});
    return () => { live = false; };
  }, [blob, edit.brightness, edit.contrast, edit.lutName, edit.lutStrength, maxEdge]);
  return <canvas ref={ref} />;
}

export function BlobImg({ blob, alt = '' }: { blob: Blob; alt?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? <img src={url} alt={alt} /> : null;
}

/** Round crop of one face from a thumbnail. */
export function FaceCrop({ thumb, box }: { thumb: Blob; box: Rect }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    createImageBitmap(thumb).then((bmp) => {
      if (live && ref.current) {
        const c = ref.current;
        c.width = c.height = 112;
        const pad = 0.25;
        const sx = (box.x - box.w * pad) * bmp.width, sy = (box.y - box.h * pad) * bmp.height;
        const sw = box.w * (1 + 2 * pad) * bmp.width, sh = box.h * (1 + 2 * pad) * bmp.height;
        const side = Math.max(sw, sh);
        c.getContext('2d')!.drawImage(bmp, sx + (sw - side) / 2, sy + (sh - side) / 2, side, side, 0, 0, 112, 112);
      }
      bmp.close();
    }).catch(() => {});
    return () => { live = false; };
  }, [thumb, box.x, box.y, box.w, box.h]);
  return <div class="face"><canvas ref={ref} /></div>;
}
