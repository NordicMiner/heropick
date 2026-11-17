import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

function precacheBytes(dir: string): number {
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) total += precacheBytes(p);
    else if (/\.(js|css|html|json|bin|cube|wasm|png|svg)$/.test(e.name)) total += statSync(p).size;
  }
  return total;
}

test('works with no signal after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'HeroPick' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__heropickOffline?.()), { timeout: 60_000 }).toBe('ready');
  await expect(page.getByText('Offline ready')).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'HeroPick' })).toBeVisible();
  const loaded = await page.evaluate(() => (window as any).__heropickInitFaces().then(() => 'ok', (e: Error) => e.message));
  expect(loaded).toBe('ok');
  await expect(page.getByText('Offline ready')).toBeVisible();
});

test('everything cached is under 50 MB', () => {
  const mb = precacheBytes('dist') / 1024 / 1024;
  console.log(`precache total ${mb.toFixed(1)} MB`);
  expect(mb).toBeLessThan(50);
});
