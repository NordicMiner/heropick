// Copies the four face-api models the app needs into public/models.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
const src = 'node_modules/@vladmandic/face-api/model';
const dst = 'public/models';
const keep = ['ssd_mobilenetv1', 'face_landmark_68_model', 'face_recognition', 'face_expression'];
mkdirSync(dst, { recursive: true });
for (const f of readdirSync(src)) {
  if (keep.some((k) => f.startsWith(k)) && !f.includes('tiny')) copyFileSync(`${src}/${f}`, `${dst}/${f}`);
}
console.log('models:', readdirSync(dst).join(', '));
