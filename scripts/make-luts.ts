// Generates the four built-in photo looks as size-33 .cube files in public/luts.
// Run: npm run luts
import { mkdirSync, writeFileSync } from 'node:fs';

type RGB = [number, number, number];
const SIZE = 33;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (x: number) => x * x * (3 - 2 * x);
const curve = (x: number, k: number) => clamp(x + k * (smooth(x) - x));
const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const each = (c: RGB, f: (v: number) => number): RGB => [f(c[0]), f(c[1]), f(c[2])];

const looks: Record<string, (c: RGB) => RGB> = {
  clean: (c) => each(c, (v) => curve(v, 0.08)),
  warm: ([r, g, b]) => each([clamp(r * 1.04), g, clamp(b * 0.94)], (v) => curve(v, 0.08)),
  punchy: (c) => {
    const y = luma(c);
    return each(each(c, (v) => clamp(y + 1.25 * (v - y))), (v) => curve(v, 0.15));
  },
  mono: (c) => {
    const y = curve(luma(c), 0.1);
    return [y, y, y];
  },
};

mkdirSync('public/luts', { recursive: true });
for (const [name, fn] of Object.entries(looks)) {
  const lines = [`TITLE "HeroPick ${name}"`, `LUT_3D_SIZE ${SIZE}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < SIZE; b++)
    for (let g = 0; g < SIZE; g++)
      for (let r = 0; r < SIZE; r++) {
        const out = fn([r / (SIZE - 1), g / (SIZE - 1), b / (SIZE - 1)]);
        lines.push(out.map((v) => v.toFixed(6)).join(' '));
      }
  writeFileSync(`public/luts/${name}.cube`, lines.join('\n') + '\n');
  console.log(`wrote public/luts/${name}.cube`);
}
