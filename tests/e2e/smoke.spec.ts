import { expect, test } from '@playwright/test';

test('shows the HeroPick heading', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HeroPick');
});
