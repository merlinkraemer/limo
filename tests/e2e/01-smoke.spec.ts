import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('page loads and shows leaderboard', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /lemolist/i })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: 'add your lemonade' })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: 'rules' })).toBeVisible();
  });

  test('shows empty state when no entries', async ({ page }) => {
    await page.goto('/');

    const emptyCell = page.getByText('no entries yet');
    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(emptyCell).toBeVisible();
  });
});
