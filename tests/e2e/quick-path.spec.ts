import { expect, test, type Page } from '@playwright/test';

/** Make n distinct JPEGs inside the page (noise images, 1 minute apart) and return them for setInputFiles. */
async function makePhotos(page: Page, n: number, framesPerMoment = 1) {
  const list = await page.evaluate(async ([count, per]) => {
    const out: { name: string; b64: string }[] = [];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('canvas');
      c.width = 600; c.height = 400;
      const ctx = c.getContext('2d')!;
      const img = ctx.createImageData(600, 400);
      const moment = Math.floor(i / per);
      let s = (moment + 1) * 9301;
      for (let p = 0; p < img.data.length; p += 4) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const v = s >>> 24;
        const tweak = i % per; // sibling frames: same scene, tiny change
        img.data[p] = Math.min(255, v + tweak * 3); img.data[p + 1] = (v + moment * 20) & 255; img.data[p + 2] = 255 - v; img.data[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const url = c.toDataURL('image/jpeg', 0.9);
      out.push({ name: `IMG_${String(i).padStart(4, '0')}.JPG`, b64: url.split(',')[1] });
    }
    return out;
  }, [n, framesPerMoment] as const);
  return list.map((f) => ({ name: f.name, mimeType: 'image/jpeg', buffer: Buffer.from(f.b64, 'base64') }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Test hooks: no face model, and record what gets shared.
    (window as any).__heropickTestDetect = async () => [];
    (window as any).__shared = [];
    (navigator as any).canShare = () => true;
    (navigator as any).share = async (data: { files: File[] }) => {
      (window as any).__shared.push(...data.files.map((f) => f.name));
    };
  });
});

const tileIds = (page: Page) => page.getByTestId('hero-tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));

test('pick, grow, swap, look, share, and survive a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Quick pick' }).click();
  await expect(page.getByText('What did you shoot?')).toBeVisible();
  await page.getByRole('button', { name: 'Government' }).click();
  await page.locator('input[type=file]').setInputFiles(await makePhotos(page, 12));

  await expect(page.getByRole('heading', { name: 'Your best 6' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('hero-tile')).toHaveCount(6);

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('heading', { name: 'Your best 8' })).toBeVisible();
  await expect(page.getByTestId('hero-tile')).toHaveCount(8);

  const before = await tileIds(page);
  await page.getByTestId('hero-tile').first().click();
  await page.getByRole('button', { name: 'Swap' }).click();
  await page.getByTestId('swap-option').first().click();
  const after = await tileIds(page);
  expect(after[0]).not.toBe(before[0]);
  expect(after.slice(1)).toEqual(before.slice(1));

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Mono' }).click();
  await page.getByRole('button', { name: 'Apply to all' }).click();
  await expect(page.getByTestId('hero-tile').first()).toHaveAttribute('data-look', 'Mono');

  await page.getByRole('button', { name: 'Share' }).click();
  // Tap 1 prepares the JPEGs; tap 2 opens the share sheet (iOS needs a fresh tap for that).
  await page.getByRole('button', { name: 'Send 8 photos' }).click({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(8);
  const shared: string[] = await page.evaluate(() => (window as any).__shared);
  for (const name of shared) expect(name).toMatch(/^IMG_\d{4}-hp\.jpg$/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your best 8' })).toBeVisible();
  expect(await tileIds(page)).toEqual(after);
  await expect(page.getByTestId('hero-tile').first()).toHaveAttribute('data-look', 'Mono');
});

test('Fewer stops at 4 and More stops at 10', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Quick pick' }).click();
  await page.getByRole('button', { name: 'Government' }).click();
  await page.locator('input[type=file]').setInputFiles(await makePhotos(page, 14));
  await expect(page.getByRole('heading', { name: 'Your best 6' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Fewer' }).click();
  await page.getByRole('button', { name: 'Fewer' }).click();
  await expect(page.getByTestId('hero-tile')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Fewer' })).toBeDisabled();
  for (let i = 0; i < 8; i++) if (await page.getByRole('button', { name: 'More' }).isEnabled()) await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByTestId('hero-tile')).toHaveCount(10);
});

test('unreadable files are reported in plain words', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Quick pick' }).click();
  await page.getByRole('button', { name: 'Government' }).click();
  const files = await makePhotos(page, 5);
  files.push({ name: 'broken.JPG', mimeType: 'image/jpeg', buffer: Buffer.from([1, 2, 3]) });
  files.push({ name: 'empty.JPG', mimeType: 'image/jpeg', buffer: Buffer.alloc(0) });
  await page.locator('input[type=file]').setInputFiles(files);
  await expect(page.getByText("2 photos couldn't be read")).toBeVisible({ timeout: 30_000 });
});

test('quick taps then an immediate reload bring back tiles, looks and every swap strip', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Quick pick' }).click();
  await page.getByRole('button', { name: 'Government' }).click();
  await page.locator('input[type=file]').setInputFiles(await makePhotos(page, 48, 4)); // 12 moments × 4 frames
  await expect(page.getByRole('heading', { name: 'Your best 6' })).toBeVisible({ timeout: 30_000 });

  const strips = async () => {
    const out: (string | null)[][] = [];
    const n = await page.getByTestId('hero-tile').count();
    for (let i = 0; i < n; i++) {
      await page.getByTestId('hero-tile').nth(i).click();
      await page.getByRole('button', { name: 'Swap' }).click();
      out.push(await page.getByTestId('swap-option').evaluateAll((els) => els.map((e) => e.getAttribute('data-id'))));
      await page.getByRole('button', { name: 'Back' }).click();
    }
    return out;
  };

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByTestId('hero-tile').first().click();
  await page.getByRole('button', { name: 'Swap' }).click();
  await page.getByTestId('swap-option').nth(1).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Warm' }).click();
  await page.getByRole('button', { name: 'Apply to all' }).click();
  const tiles = await tileIds(page);
  const before = await strips();
  expect(before.every((s) => s.length > 0)).toBe(true);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your best 7' })).toBeVisible();
  expect(await tileIds(page)).toEqual(tiles);
  await expect(page.getByTestId('hero-tile').first()).toHaveAttribute('data-look', 'Warm');
  expect(await strips()).toEqual(before);
});
