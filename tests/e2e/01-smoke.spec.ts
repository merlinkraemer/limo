import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('page loads and shows the redesigned leaderboard', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'lemolist' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'leaderboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'add your limo' }).first()).toBeVisible();
  });

  test('opens the add sheet from the header on desktop', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'add yours' }).click();

    await expect(page.getByRole('dialog', { name: 'add your limo' })).toBeVisible();
    await expect(page.locator('#add-q')).toHaveAttribute('placeholder', 'how is it called?');
  });
});
