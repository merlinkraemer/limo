import { test, expect } from '@playwright/test';

test.describe('add and rate lemonade', () => {
  test('creates a new listing with a real first rating', async ({ page }) => {
    const name = `E2E Test Limo ${Date.now()}`;
    await page.goto('/');

    await page.getByRole('button', { name: 'add yours' }).click();
    await page.locator('#add-q').fill(name);
    await page.getByRole('button', { name: /as new/ }).click();

    await expect(page.locator('#f-name')).toHaveValue(name);
    await page.getByRole('button', { name: '7 out of 10 stars' }).click();
    await page.getByRole('button', { name: 'yepp' }).click();
    await page.getByRole('button', { name: 'add limo' }).click();

    await expect(page.getByText('added! 🍋')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/is in at/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'leaderboard' })).toBeVisible();
    await expect(page.locator('.row-name', { hasText: name }).first()).toBeVisible();
  });

  test('shows a duplicate warning and offers to rate instead', async ({ page }) => {
    const existing = `E2E Dupe Existing ${Date.now()}`;
    const other = `E2E Dupe Other ${Date.now()}`;

    const create = async (name: string) => {
      await page.getByRole('button', { name: 'add yours' }).click();
      await page.locator('#add-q').fill(name);
      await page.getByRole('button', { name: /as new/ }).click();
      await page.getByRole('button', { name: '6 out of 10 stars' }).click();
      await page.getByRole('button', { name: 'add limo' }).click();
      await expect(page.getByText('added! 🍋')).toBeVisible({ timeout: 15000 });
      await page.keyboard.press('Escape');
      await expect(page.getByText('added! 🍋')).toBeHidden();
    };

    await page.goto('/');
    await create(existing);
    await create(other);

    await page.getByRole('button', { name: 'add yours' }).click();
    await page.locator('#add-q').fill(existing);
    await page.getByRole('button', { name: /as new/ }).click();
    await page.getByRole('button', { name: '5 out of 10 stars' }).click();
    await page.getByRole('button', { name: 'add limo' }).click();

    await expect(page.getByText(/already exists - rate it instead/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'rate it instead' })).toBeVisible();
  });

  test('rates an existing listing and shows the saved state', async ({ page }) => {
    const name = `E2E Rate Limo ${Date.now()}`;
    await page.goto('/');

    await page.getByRole('button', { name: 'add yours' }).click();
    await page.locator('#add-q').fill(name);
    await page.getByRole('button', { name: /as new/ }).click();
    await page.getByRole('button', { name: '8 out of 10 stars' }).click();
    await page.getByRole('button', { name: 'add limo' }).click();
    await expect(page.getByText('added! 🍋')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('added! 🍋')).toBeHidden();

    await page.getByRole('button', { name: 'add yours' }).click();
    await page.locator('#add-q').fill(name);
    await expect(page.getByRole('button', { name: /rate →/ }).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /rate →/ }).first().click();

    await expect(page.getByText('edit your rating')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '4 out of 10 stars' }).click();
    await page.getByRole('button', { name: 'update rating' }).click();

    await expect(page.getByText(/saved for/)).toBeVisible({ timeout: 15000 });
  });
});
