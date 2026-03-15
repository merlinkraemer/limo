import { test, expect } from '@playwright/test';

test.describe('add lemonade', () => {
  test('opens add modal and submits new entry', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'add your lemonade' }).click();

    const modal = page.getByRole('heading', { name: 'add ur lemonade' });
    await expect(modal).toBeVisible();

    await page.getByLabel(/lemonade name/i).fill('E2E Test Limo');
    await page.getByLabel(/description/i).fill('Added by Playwright');
    await page.getByLabel(/city/i).fill('CI');

    const flavorStars = page.locator('.star-rating').first().locator('.star');
    await flavorStars.nth(6).click();
    const sournessStars = page.locator('.star-rating').last().locator('.star');
    await sournessStars.nth(4).click();

    await page.getByRole('button', { name: 'add lemonade' }).click();

    await expect(page.getByText('submitting')).toBeHidden({ timeout: 15000 });

    const errorMsg = page.locator('.modal p.error');
    if (await errorMsg.isVisible()) {
      throw new Error(`Submit failed: ${await errorMsg.textContent()}`);
    }

    await expect(modal).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'E2E Test Limo' }).first()).toBeVisible();
    await expect(page.getByText('6.3 ☆')).toBeVisible();
  });
});
