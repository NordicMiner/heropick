import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

test('mark picks on the tune page and download them', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__heropickTestDetect = async () => []; });
  await page.goto('./#tune');
  await expect(page.getByRole('heading', { name: 'Tune' })).toBeVisible();

  const files = await page.evaluate(async () => {
    const out: { name: string; b64: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const c = document.createElement('canvas');
      c.width = 300; c.height = 200;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = `hsl(${i * 70}, 60%, 50%)`;
      ctx.fillRect(0, 0, 300, 200);
      ctx.fillStyle = '#fff';
      ctx.fillRect(i * 40, 20, 60, 120);
      out.push({ name: `T${i}.JPG`, b64: c.toDataURL('image/jpeg').split(',')[1] });
    }
    return out;
  });
  await page.locator('input[type=file]').setInputFiles(files.map((f) => ({ name: f.name, mimeType: 'image/jpeg', buffer: Buffer.from(f.b64, 'base64') })));
  await expect(page.getByTestId('tune-photo')).toHaveCount(5, { timeout: 30_000 });

  await page.getByTestId('tune-photo').nth(1).click();
  await page.getByTestId('tune-photo').nth(3).click();
  await expect(page.getByText('2 picked')).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download picks' }).click()]);
  const text = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const labels = JSON.parse(text);
  expect(labels.profileId).toBe('government');
  expect(labels.picked.sort()).toEqual(['T1.JPG', 'T3.JPG']);
  expect(labels.n).toBe(6);

  const [m] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download measurements' }).click()]);
  const metrics = JSON.parse(await (await m.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(metrics).toHaveLength(5);
});
