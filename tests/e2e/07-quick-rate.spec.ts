import { test, expect, type Page } from '@playwright/test';

/**
 * Quick game rating: a game round's follow-up sheet asks for the score only,
 * keeps whatever traits/comment the browser already stored for that listing,
 * and cancel hands control back to the game instead of the search view.
 *
 * These tests run on the desktop project, where the game board is inline and
 * always visible (no start button required).
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
  const row = page.locator('.board .row', { hasText: name }).first();
  if (!(await row.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /show all/ }).click();
  }
  await row.click();
  const detail = page.getByRole('dialog', { name });
  await expect(detail).toBeVisible();
  return detail;
}

/** The last round's submit opens the end modal (game finished); dismiss it. */
async function dismissEnd(page: Page) {
  const end = page.getByRole('dialog', { name: 'thanks for playing!' });
  if (await end.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(end).toBeHidden();
  }
}

test.describe('quick game rating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('game sheet is score-only, cancel returns to the game, score persists', async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    await createListing(page, `E2E Quick Rate A ${stamp}`, 7);
    await createListing(page, `E2E Quick Rate B ${stamp}`, 5);

    const leftName = (
      await page.locator('.card-wrap[data-card-position="left"] .qc-name').first().textContent()
    )?.trim();
    expect(leftName).toBeTruthy();

    const leftCard = page.locator('.card-wrap[data-card-position="left"] button.qc');
    await leftCard.click();
    const hadIt = page.locator('[data-act="game-had-it"]');
    await expect(hadIt).toBeVisible();
    await hadIt.click();

    let rate = page.getByRole('dialog', { name: 'rate this lemonade' });
    await expect(rate).toBeVisible();
    await expect(rate.locator('.traits')).toBeHidden();
    await expect(rate.getByRole('button', { name: '+ add a comment' })).toBeHidden();

    // Cancel returns to the game, not the add/search view.
    await page.keyboard.press('Escape');
    await expect(rate).toBeHidden();
    await expect(page.locator('#add-q')).toBeHidden();
    await expect(hadIt).toBeVisible();

    await hadIt.click();
    await expect(rate).toBeVisible();
    await rate.getByRole('button', { name: '9 out of 10 stars' }).click();
    await rate.getByRole('button', { name: /update rating|submit rating/ }).click();
    await expect(rate).toBeHidden();

    await dismissEnd(page);
    const detail = await openDetail(page, leftName as string);
    await expect(detail.locator('.my-rating')).toContainText('your rating: 9/10');
  });

  test('game score-only re-rating keeps the stored trait and comment', async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    await createListing(page, `E2E Quick Rate Preserve A ${stamp}`, 7);
    await createListing(page, `E2E Quick Rate Preserve B ${stamp}`, 5);

    const leftName = (
      await page.locator('.card-wrap[data-card-position="left"] .qc-name').first().textContent()
    )?.trim();
    expect(leftName).toBeTruthy();

    // Rate that side's listing the ordinary way first: score + trait + comment.
    const detail = await openDetail(page, leftName as string);
    await detail.getByRole('button', { name: /rate it|edit your rating/ }).click();
    let rate = page.getByRole('dialog', { name: 'rate this lemonade' });
    await expect(rate).toBeVisible();
    await rate.getByRole('button', { name: '2 out of 10 stars' }).click();
    await rate.getByRole('button', { name: 'yepp' }).click();
    await rate.getByRole('button', { name: '+ add a comment' }).click();
    await rate.locator('#rate-comment').fill('full rating comment');
    await rate.getByRole('button', { name: /update rating|submit rating/ }).click();
    await expect(rate).toBeHidden();
    await expect(detail).toBeVisible();
    await detail.locator('.detail-actions').getByRole('button', { name: 'close' }).click();
    await expect(detail).toBeHidden();

    // The same round is still up: pick the left card and re-rate from the game.
    const leftCard = page.locator('.card-wrap[data-card-position="left"] button.qc');
    await expect(leftCard).toBeVisible();
    await leftCard.click();
    await page.locator('[data-act="game-had-it"]').click();
    rate = page.getByRole('dialog', { name: 'rate this lemonade' });
    await expect(rate).toBeVisible();
    await expect(rate.locator('.traits')).toBeHidden();
    await rate.getByRole('button', { name: '9 out of 10 stars' }).click();
    await rate.getByRole('button', { name: /update rating|submit rating/ }).click();
    await expect(rate).toBeHidden();

    await dismissEnd(page);
    const reopened = await openDetail(page, leftName as string);
    await expect(reopened.locator('.my-rating')).toContainText('your rating: 9/10');
    await expect(reopened.locator('.my-rating')).toContainText('full rating comment');

    // The ordinary sheet still exposes the characteristics and the comment.
    await reopened.getByRole('button', { name: 'edit your rating' }).click();
    rate = page.getByRole('dialog', { name: 'rate this lemonade' });
    await expect(rate).toBeVisible();
    await expect(rate.locator('.traits')).toBeVisible();
    await expect(rate.locator('#rate-comment')).toHaveValue('full rating comment');
    await expect(rate.getByRole('button', { name: 'yepp' })).toHaveAttribute('aria-pressed', 'true');
  });
});
