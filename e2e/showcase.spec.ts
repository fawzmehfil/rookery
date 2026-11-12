import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/editor');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('health endpoint responds', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
});

test('loads the First Flight showcase', async ({ page }) => {
  await page.getByRole('button', { name: 'Load First Flight' }).click();
  await expect(page.getByText('First Flight loaded as an independent editable draft')).toBeVisible();
});