import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('checker works end to end without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/RAW Sidecar Sanity/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('img:not([alt])')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try a labelled sample', exact: true }).click();
  await expect(page.getByText('3 pairs examined')).toBeVisible();
  await expect(page.getByText('Aspect ratios disagree')).toBeVisible();
  await page.getByRole('button', { name: 'timestamp', exact: true }).click();
  await expect(page.getByText('Capture times disagree')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await expect((await download).suggestedFilename()).toMatch(/raw-sidecar-sanity.*\.csv/);
  expect(errors).toEqual([]);
});

test('has no serious or critical axe findings', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('legal pages route and mobile does not overflow', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/stay on your bench/);
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/careful preflight/);
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('app shell reloads offline after first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 15_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Catch a bad pair');
});
