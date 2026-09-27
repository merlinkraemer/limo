import { test, expect, type Page } from '@playwright/test';

/**
 * Detail → rate flow: the rate sheet must own the top layer (detail hides),
 * cancellation must return to the origin detail modal, and saving must show
 * the refreshed detail with updated score and only the traits that were rated.
 */

async function createListing(page: Page, name: string, stars: number) {
  await page.getByRole('button', { name: 'add yours' }).click();
  await page.locator('#add-q').fill(name);
  await page.getByRole('button', { name: /as new/ }).click();
  await page.getByRole('button', { name: `${stars} out of 10 stars` }).click();
  await page.getByRole('button', { name: 'add limo' }).click();
  await expect(page.getByText('added! 🍋')).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect(page.getByText('added! 🍋')).toBeHidden();
}

async function openDetail(page: Page, name: string) {
  await page.locator('.board .row', { hasText: name }).first().click();
  const detail = page.getByRole('dialog', { name });
  await expect(detail).toBeVisible();
  return detail;
}

test.describe('detail to rate flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('cancel from the rate sheet returns to the origin detail modal', async ({ page }) => {
    const name = `E2E Detail Cancel ${Date.now()}`;
    await createListing(page, name, 7);
    const detail = await openDetail(page, name);

    await detail.getByRole('button', { name: /rate it|edit your rating/ }).click();
    const rate = page.getByRole('dialog', { name: 'rate this lemonade' });
    await expect(rate).toBeVisible();
    await expect(detail).toBeHidden();

    await page.keyboard.press('Escape');

    await expect(rate).toBeHidden();
    await expect(detail).toBeVisible();
    await expect(page.locator('.sheet-host.detail [data-first]')).toBeFocused();
  });

  test('saving reopens the refreshed detail with only the rated traits', async ({ page }) => {
    const name = `E2E Detail Save ${Date.now()}`;
    await createListing(page, name, 7);
    const detail = await openDetail(page, name);

    // The creator's first rating carried no traits: no "–" rows are rendered.
    await expect(detail.locator('.detail-trait .qc-lab')).toHaveText(['score']);

    await detail.getByRole('button', { name: /rate it|edit your rating/ }).click();
    const rate = page.getByRole('dialog', { name: 'rate this lemonade' });
    await expect(rate).toBeVisible();
    await expect(detail).toBeHidden();

    await rate.getByRole('button', { name: '3 out of 10 stars' }).click();
    await rate.getByRole('button', { name: 'yepp' }).click();
    await rate.getByRole('button', { name: /update rating|submit rating/ }).click();

    await expect(rate).toBeHidden();
    await expect(detail).toBeVisible();
    await expect(detail.locator('.detail-score-value strong')).toHaveText('3.0');
    await expect(detail.locator('.detail-trait .qc-lab')).toHaveText(['score', 'sour']);
    await expect(detail.locator('.detail-trait', { hasText: 'sour' })).toContainText('yepp');
    await expect(detail.locator('.detail-trait', { hasText: 'sweet' })).toHaveCount(0);
    await expect(page.locator('.sheet-host.detail [data-first]')).toBeFocused();
  });
});
