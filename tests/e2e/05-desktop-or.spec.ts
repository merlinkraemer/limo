import { test, expect, type Page } from '@playwright/test';

/**
 * Desktop-only regression: the game column has a duplicated `.or` grid that
 * pushed the inner "or" word below the vertical midpoint between the cards.
 */

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
  cx: number;
  cy: number;
}

async function ensureListings(page: Page, count: number) {
  await page.goto('/');
  let existing = await page.locator('.board > li').count();
  const stamp = Date.now();
  while (existing < count) {
    const name = `E2E Or Limo ${stamp}-${existing}`;
    await page.getByRole('button', { name: 'add yours' }).click();
    await page.locator('#add-q').fill(name);
    await page.getByRole('button', { name: /as new/ }).click();
    await page.getByRole('button', { name: '6 out of 10 stars' }).click();
    await page.getByRole('button', { name: 'add limo' }).click();
    await expect(page.getByText('added! 🍋')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('added! 🍋')).toBeHidden();
    existing += 1;
  }
}

function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string): Box => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`missing ${selector}`);
      const rect = el.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
      };
    };
    return {
      left: box('.card-wrap[data-card-position="left"]'),
      right: box('.card-wrap[data-card-position="right"]'),
      or: box('.game .or'),
      word: box('.game .or-text'),
    };
  });
}

test.describe('desktop game column', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the "or" is centered between the two cards', async ({ page }) => {
    await ensureListings(page, 2);
    await page.goto('/');
    await expect(page.locator('.game .or-text')).toBeVisible();

    const g = await geometry(page);
    // The wrapper and its word share the row's vertical center.
    expect(Math.abs(g.word.cy - g.or.cy)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.word.cy - g.left.cy)).toBeLessThanOrEqual(2);
    // Horizontally halfway between the facing card edges.
    expect(Math.abs(g.word.cx - (g.left.right + g.right.left) / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.word.cx - g.or.cx)).toBeLessThanOrEqual(2);
  });

  test('the follow-up layout still replaces the word with the actions block', async ({ page }) => {
    await ensureListings(page, 2);
    await page.goto('/');
    await page.locator('.card-wrap[data-card-position="left"] button.qc').click();
    await expect(page.locator('.game .or.has-followup')).toBeVisible();
    await expect(page.locator('.game .or-text')).toHaveCount(0);
    await expect(page.locator('.game-followup-copy')).toHaveText('did you drink this?');
    await expect(page.getByRole('button', { name: 'next!' })).toBeVisible();
  });
});

test.describe('mobile game column', () => {
  test('the "or" stays between the stacked cards', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ensureListings(page, 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.locator('.top-actions .btn').first().click();
    await expect(page.locator('.game-layer.is-open')).toBeVisible();
    await expect(page.locator('.game .or-text')).toBeVisible();

    const g = await geometry(page);
    expect(g.left.bottom).toBeLessThanOrEqual(g.or.top + 1);
    expect(g.or.bottom).toBeLessThanOrEqual(g.right.top + 1);
    expect(Math.abs(g.word.cx - g.left.cx)).toBeLessThanOrEqual(2);
  });
});
