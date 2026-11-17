import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import viteConfig from './vite.config.ts';

// Local-only real-photo tests: set HEROPICK_SAMPLES to a folder of JPEGs. Never committed.
const samples = process.env.HEROPICK_SAMPLES ?? '';

function listSamples(_ctx: unknown, limit = 10): string[] {
  if (!samples) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.jpe?g$/i.test(e.name)) out.push(p);
    }
  };
  walk(samples);
  out.sort();
  // Evenly spaced across the shoot, not just the first few frames.
  if (out.length <= limit) return out;
  return Array.from({ length: limit }, (_, i) => out[Math.floor((i * out.length) / limit)]);
}

/** Reads one sample photo (from listSamples) as base64. Works for cloud-synced folders the dev server won't serve. */
function readSample(_ctx: unknown, path: string): string {
  if (!samples || !path.startsWith(samples.replace(/\//g, sep))) throw new Error('not a sample path');
  return readFileSync(path).toString('base64');
}

/** Writes tuning data into the gitignored samples/ folder only. */
function writeSample(_ctx: unknown, name: string, text: string): void {
  if (!/^[\w.-]+$/.test(name)) throw new Error('bad sample name');
  mkdirSync('samples/metrics', { recursive: true });
  writeFileSync(join('samples/metrics', name), text);
}

export default mergeConfig(viteConfig, defineConfig({
  optimizeDeps: { include: ['exifr', 'idb-keyval', '@vladmandic/face-api'] },
  server: { fs: { allow: ['.', ...(samples ? [samples] : [])] } },
  define: { __HEROPICK_DUMP__: JSON.stringify(process.env.HEROPICK_DUMP ?? '') },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 120_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'webkit' }],
      commands: { listSamples, readSample, writeSample },
    },
  },
}));
