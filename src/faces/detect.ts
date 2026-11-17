import * as faceapi from '@vladmandic/face-api';
import type { Face } from '../core/types';
import { makeCanvas } from '../core/canvas';
import { eyesOpenScore, mouthOpenScore } from './geometry';

let ready: Promise<void> | null = null;

/** Load the four nets once. Backend: WebGL, falling back to CPU. */
export function initFaces(modelBase = `${import.meta.env.BASE_URL}models`): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const tf = faceapi.tf as unknown as { setBackend(b: string): Promise<boolean>; ready(): Promise<void> };
      let ok = false;
      try { ok = await tf.setBackend('webgl'); } catch { ok = false; }
      if (!ok) await tf.setBackend('cpu');
      await tf.ready();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelBase),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelBase),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelBase),
        faceapi.nets.faceExpressionNet.loadFromUri(modelBase),
      ]);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

function toCanvas(src: ImageBitmap | HTMLCanvasElement): HTMLCanvasElement {
  if (src instanceof HTMLCanvasElement) return src;
  const c = makeCanvas(src.width, src.height);
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

export async function detectFaces(src: ImageBitmap | HTMLCanvasElement): Promise<Face[]> {
  await initFaces();
  const canvas = toCanvas(src);
  const W = canvas.width, H = canvas.height;
  let results;
  try {
    results = await faceapi
      .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptors();
  } finally {
    if (canvas !== src) { canvas.width = 0; canvas.height = 0; } // free the copy (iOS canvas memory cap)
  }
  const faces: Face[] = [];
  for (const r of results) {
    const b = r.detection.box;
    if (b.height / H < 0.02) continue;
    const lm = r.landmarks;
    faces.push({
      box: { x: b.x / W, y: b.y / H, w: b.width / W, h: b.height / H },
      eyesOpen: eyesOpenScore(lm.getLeftEye(), lm.getRightEye()),
      happy: r.expressions.happy ?? 0,
      mouthOpen: mouthOpenScore(lm.positions, b.height),
      descriptor: r.descriptor,
    });
  }
  return faces;
}
